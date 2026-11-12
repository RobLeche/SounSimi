import { useEffect, useId, useRef, useState } from "react";
import { fetchSuggestions } from "../api.js";
import { SearchIcon, SpinnerIcon } from "./Icons.jsx";

// Combobox that only lets people pick real catalog tracks (Deezer, iTunes fallback).
export default function SearchBox({ onPick, busy, initial }) {
  const [text, setText] = useState(initial ? `${initial.song} — ${initial.artist}` : "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(null);
  const listId = useId();
  const pickedRef = useRef(initial ? `${initial.song} — ${initial.artist}` : null);
  const reqRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (initial) {
      const label = `${initial.song} — ${initial.artist}`;
      pickedRef.current = label;
      setText(label);
    }
  }, [initial?.song, initial?.artist]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === pickedRef.current) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      reqRef.current?.abort();
      const ctrl = new AbortController();
      reqRef.current = ctrl;
      try {
        const results = await fetchSuggestions(q, ctrl.signal);
        setItems(results);
        setActive(results.length ? 0 : -1);
        setOpen(true);
        setHint(results.length ? null : "No songs found — check the spelling.");
      } catch (err) {
        if (err.name !== "AbortError") setHint("Suggestions are unavailable right now.");
      } finally {
        if (reqRef.current === ctrl) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const close = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (item) => {
    const label = `${item.song} — ${item.artist}`;
    pickedRef.current = label;
    setText(label);
    setItems([]);
    setOpen(false);
    setHint(null);
    onPick({ song: item.song, artist: item.artist });
  };

  const submit = () => {
    if (items[active]) return choose(items[active]);
    if (items[0]) return choose(items[0]);
    if (pickedRef.current && text === pickedRef.current) {
      const [song, artist] = text.split(" — ");
      return onPick({ song, artist });
    }
    setHint(text.trim().length < 2 ? "Type a song or artist name." : "Pick a song from the suggestions.");
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && items.length > 0;

  return (
    <div className="searchbox" ref={wrapRef}>
      <label className="field">
        <span>Song or artist</span>
        <div className="input-wrap">
          <SearchIcon />
          <input
            value={text}
            onChange={(e) => {
              pickedRef.current = null;
              setText(e.target.value);
              setHint(null);
            }}
            onFocus={() => items.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Start typing… e.g. Bohemian Rhapsody"
            autoComplete="off"
            spellCheck="false"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          />
          {loading && <SpinnerIcon />}
        </div>
      </label>

      {showList && (
        <ul className="suggestions glass" id={listId} role="listbox">
          {items.map((it, i) => (
            <li
              key={`${it.song}-${it.artist}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(it)}
            >
              {it.artwork ? <img src={it.artwork} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="sugg-art" />}
              <span className="sugg-text">
                <b>{it.song}</b>
                <em>{it.artist}{it.album ? ` · ${it.album}` : ""}</em>
              </span>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="hint">{hint}</p>}

      <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? <><SpinnerIcon /> Finding real matches…</> : <><SearchIcon /> Find similar songs</>}
      </button>
    </div>
  );
}
