"""
tiny_gpt.py - a complete, trainable GPT-style language model in about 150 lines of PyTorch.

This is the same architecture family as Claude, scaled down by a factor of roughly a million:
token embeddings + position embeddings -> N transformer blocks (causal self-attention + MLP)
-> a linear layer that scores every possible next token. Training is next-token prediction
with cross-entropy loss. Generation samples one token at a time and feeds it back in.

What it does NOT have (and Claude does): billions of parameters, trillions of training tokens,
a learned subword tokenizer, instruction tuning and RLHF / Constitutional AI, tool use.

Run:  pip install torch
      python tiny_gpt.py                    # trains on the built-in text for ~1-3 minutes on a laptop CPU
      python tiny_gpt.py my_corpus.txt      # or on any plain-text file (a few hundred KB is plenty)

Inspired by Andrej Karpathy's nanoGPT (now succeeded by his nanochat) and his "Let's build GPT"
lecture, which are the next step.
"""
import math
import sys

import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(0)

# ------------------------------------------------------------------ hyperparameters
BLOCK = 64        # context length: how many previous characters the model can see
EMBED = 96        # width of every token vector
HEADS = 4         # attention heads per block
LAYERS = 3        # transformer blocks
STEPS = 2000
BATCH = 32
LR = 3e-3

def default_text(n=4000, seed=0):
    """Sentences from a tiny grammar. The model can't memorize them all, so it must learn the
    pattern: spelling, word order, and which words go together."""
    import random
    rng = random.Random(seed)
    who = ["the robot", "the agent", "a small rover", "the vacuum", "my drone", "the arm"]
    verb = ["moves to", "looks at", "drives toward", "maps", "cleans", "avoids", "inspects"]
    what = ["the kitchen", "a red box", "the charging dock", "the wall", "the door", "a sample"]
    why = ["because the battery is low", "to reach its goal", "after it senses dirt",
           "when the path is clear", "while it plans", "before it stops"]
    return "".join(f"{rng.choice(who)} {rng.choice(verb)} {rng.choice(what)} {rng.choice(why)}. "
                   for _ in range(n))


# ------------------------------------------------------------------ data: characters as tokens
text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else default_text()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[i] for i in ids)
data = torch.tensor(encode(text), dtype=torch.long)
split = int(0.9 * len(data))
train_data, val_data = data[:split], data[split:]


def batch(source):
    ix = torch.randint(len(source) - BLOCK - 1, (BATCH,))
    x = torch.stack([source[i:i + BLOCK] for i in ix])
    y = torch.stack([source[i + 1:i + BLOCK + 1] for i in ix])    # targets: the next character
    return x, y


# ------------------------------------------------------------------ the model
class CausalSelfAttention(nn.Module):
    """Every position looks at earlier positions and takes a weighted average of their values.

    weights = softmax( Q K^T / sqrt(d) ), with future positions masked out (the "causal" part).
    """

    def __init__(self):
        super().__init__()
        self.qkv = nn.Linear(EMBED, 3 * EMBED)
        self.proj = nn.Linear(EMBED, EMBED)
        self.register_buffer("mask", torch.tril(torch.ones(BLOCK, BLOCK)).view(1, 1, BLOCK, BLOCK))

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(EMBED, dim=2)
        # (B, T, C) -> (B, heads, T, head_size)
        q, k, v = [t.view(B, T, HEADS, C // HEADS).transpose(1, 2) for t in (q, k, v)]
        att = (q @ k.transpose(-2, -1)) / math.sqrt(k.size(-1))
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).contiguous().view(B, T, C)
        return self.proj(y)


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(EMBED), nn.LayerNorm(EMBED)
        self.attn = CausalSelfAttention()
        self.mlp = nn.Sequential(nn.Linear(EMBED, 4 * EMBED), nn.GELU(), nn.Linear(4 * EMBED, EMBED))

    def forward(self, x):
        x = x + self.attn(self.ln1(x))     # residual connections let information flow straight through
        x = x + self.mlp(self.ln2(x))
        return x


class TinyGPT(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.tok = nn.Embedding(vocab, EMBED)       # token id -> vector
        self.pos = nn.Embedding(BLOCK, EMBED)       # position -> vector
        self.blocks = nn.Sequential(*[Block() for _ in range(LAYERS)])
        self.ln = nn.LayerNorm(EMBED)
        self.head = nn.Linear(EMBED, vocab)         # vector -> a score (logit) for every next token

    def forward(self, idx, targets=None):
        T = idx.size(1)
        x = self.tok(idx) + self.pos(torch.arange(T, device=idx.device))
        logits = self.head(self.ln(self.blocks(x)))
        loss = None
        if targets is not None:
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, n, temperature=0.8, top_k=None):
        for _ in range(n):
            logits, _ = self(idx[:, -BLOCK:])
            logits = logits[:, -1, :] / temperature           # only the last position predicts the future
            if top_k:
                v, _ = torch.topk(logits, top_k)
                logits[logits < v[:, [-1]]] = -float("inf")
            probs = F.softmax(logits, dim=-1)
            nxt = torch.multinomial(probs, 1)                 # sample, don't just take the max
            idx = torch.cat([idx, nxt], dim=1)
        return idx


model = TinyGPT(len(chars))
print(f"vocabulary: {len(chars)} characters, parameters: {sum(p.numel() for p in model.parameters()):,}")
opt = torch.optim.AdamW(model.parameters(), lr=LR)


@torch.no_grad()
def val_loss():
    model.eval()
    losses = [model(*batch(val_data))[1].item() for _ in range(10)]
    model.train()
    return sum(losses) / len(losses)


for step in range(STEPS + 1):
    x, y = batch(train_data)
    _, loss = model(x, y)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    opt.step()
    if step % 250 == 0:
        print(f"step {step:5d}   train loss {loss.item():.3f}   val loss {val_loss():.3f}"
              f"   (random guessing = {math.log(len(chars)):.3f})")

prompt = "the robot"
out = model.generate(torch.tensor([encode(prompt)]), 200)
print("\n--- sample ---\n" + decode(out[0].tolist()))
