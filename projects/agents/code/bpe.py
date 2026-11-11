"""
bpe.py - byte-pair encoding, the way language models (including Claude) cut text into tokens.

A model doesn't read letters or words. It reads integer token IDs. BPE learns the token
vocabulary from data:

    1. start with single characters (real tokenizers start with the 256 possible bytes)
    2. count every adjacent pair of tokens in the training text
    3. merge the most frequent pair into one new token; remember the merge
    4. repeat until the vocabulary is big enough (real models: ~50,000 - 200,000 tokens)

Encoding new text replays the merges in the order they were learned.
Claude's own tokenizer is not public, but it is a learned subword tokenizer of this family.

Run:  python bpe.py
No packages needed.
"""
from collections import Counter

TEXT = """an agent perceives its environment through sensors and acts upon that environment
through actuators. a rational agent selects the action that is expected to maximize its
performance measure. the agent program runs on the agent architecture. a learning agent
can improve its performance. an agent that plans considers the future consequences of actions."""


def pair_counts(words):
    counts = Counter()
    for word, freq in words.items():
        for a, b in zip(word, word[1:]):
            counts[(a, b)] += freq
    return counts


def merge_word(word, pair):
    out, i = [], 0
    while i < len(word):
        if i < len(word) - 1 and (word[i], word[i + 1]) == pair:
            out.append(word[i] + word[i + 1])
            i += 2
        else:
            out.append(word[i])
            i += 1
    return tuple(out)


def train(text, num_merges):
    # pre-split on spaces and mark word starts with "_" (GPT-style tokenizers use a similar trick)
    words = Counter(tuple("_" + w) for w in text.split())
    merges = []
    for _ in range(num_merges):
        counts = pair_counts(words)
        if not counts:
            break
        best = max(counts, key=lambda p: (counts[p], p))   # ties broken deterministically
        merges.append(best)
        words = Counter({merge_word(w, best): f for w, f in words.items()})
    return merges


def encode(text, merges):
    tokens = []
    for w in text.split():
        word = tuple("_" + w)
        for pair in merges:
            word = merge_word(word, pair)
        tokens.extend(word)
    return tokens


if __name__ == "__main__":
    merges = train(TEXT, 40)
    print("First 12 merges learned:")
    for i, (a, b) in enumerate(merges[:12]):
        print(f"  {i + 1:2d}. {a!r} + {b!r} -> {a + b!r}")
    vocab = sorted({t for t in encode(TEXT, merges)})
    ids = {t: i for i, t in enumerate(vocab)}
    sample = "the agent acts rationally"
    toks = encode(sample, merges)
    print(f"\n{sample!r}\n  tokens: {toks}\n  {len(sample)} characters -> {len(toks)} tokens")
    print("  ids:   ", [ids.get(t, -1) for t in toks], "  (-1 = not in this tiny vocabulary)")
