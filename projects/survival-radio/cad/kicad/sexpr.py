"""Minimal S-expression reader/writer for KiCad files (.kicad_mod, .kicad_sym, .kicad_pcb, .kicad_sch)."""
import re

_tok = re.compile(r'\s*(?:(\()|(\))|("(?:[^"\\]|\\.)*")|([^\s()"]+))')


class Sym(str):
    """An unquoted atom."""


def parse(text):
    stack, cur = [], []
    pos = 0
    while pos < len(text):
        m = _tok.match(text, pos)
        if not m:
            if text[pos:].strip() == '':
                break
            raise ValueError('bad token at %d: %r' % (pos, text[pos:pos + 40]))
        pos = m.end()
        o, c, s, a = m.groups()
        if o:
            stack.append(cur); cur = []
        elif c:
            done = cur; cur = stack.pop(); cur.append(done)
        elif s is not None:
            cur.append(s[1:-1].encode().decode('unicode_escape') if '\\' in s else s[1:-1])
        elif a is not None:
            cur.append(Sym(a))
    return cur[0] if len(cur) == 1 else cur


def q(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'


def dump(x, ind=0):
    if isinstance(x, list):
        if not x:
            return '()'
        simple = all(not isinstance(e, list) for e in x)
        if simple:
            return '(' + ' '.join(dump(e) for e in x) + ')'
        head = [e for e in x if not isinstance(e, list)]
        out = '(' + ' '.join(dump(e) for e in head)
        for e in x:
            if isinstance(e, list):
                out += '\n' + '  ' * (ind + 1) + dump(e, ind + 1)
        return out + '\n' + '  ' * ind + ')'
    if isinstance(x, Sym):
        return str(x)
    if isinstance(x, bool):
        return 'yes' if x else 'no'
    if isinstance(x, float):
        s = ('%.4f' % x).rstrip('0').rstrip('.')
        return s if s not in ('-0', '') else '0'
    if isinstance(x, int):
        return str(x)
    return q(x)


def find(x, key):
    for e in x:
        if isinstance(e, list) and e and e[0] == key:
            return e
    return None


def findall(x, key):
    return [e for e in x if isinstance(e, list) and e and e[0] == key]
