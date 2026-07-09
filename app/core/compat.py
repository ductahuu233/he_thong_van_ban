from __future__ import annotations

import collections
import collections.abc


def apply_collections_compat() -> None:
    # Python 3.10+ removed these aliases from `collections`.
    # Re-add them if missing to keep older libraries working.
    for name in ("Hashable", "Iterable", "Mapping", "MutableMapping", "Sequence"):
        if not hasattr(collections, name) and hasattr(collections.abc, name):
            setattr(collections, name, getattr(collections.abc, name))


apply_collections_compat()
