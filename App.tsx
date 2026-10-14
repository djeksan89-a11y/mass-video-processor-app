import { useEffect, useRef, useState } from 'react';
import type { Item, Settings } from './types';
import { defaultSettings, load, save } from './settings';
import { buildArgs } from './filters';
import { probe } from './probe';
import { FfmpegProcessor } from './ProcessingWorker';
import FileUploader from './FileUploader';
import VideoQueue from './VideoQueue';
import ProcessingSettings from './ProcessingSettings';
import ProfileManager from './ProfileManager';
import ProgressPanel from './ProgressPanel';
import DownloadManager from './DownloadManager';

const MAX_FILES = 50;
const MAX_OUT_BYTES = 1024 * 1024 * 1024; // предел суммарного размера готовых файлов в памяти
const proc = new FfmpegProcessor();
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function humanError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/ядро FFmpeg/i.test(m)) return m;
  if (/memory|alloc|RangeError|abort|OOM|out of bounds/i.test(m)) return 'Не хватило памяти телефона. Уменьшите разрешение или используйте файл поменьше.';
  if (/import|Failed to load|NetworkError/i.test(m)) return 'Не удалось загрузить ядро FFmpeg (нужен интернет при первом запуске).';
  return m;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [s, setS] = useState<Settings>(() => load('mvp.settings', defaultSettings()));
  const [running, setRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const cancelled = useRef(false);
  const lock = useRef(false); // защита от двойного запуска / добавления во время обработки
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  useEffect(() => save('mvp.settings', s), [s]);
  const upd = (id: string, p: Partial<Item>) => setItems(l => l.map(i => (i.id === id ? { ...i, ...p } : i)));

  async function addFiles(files: File[]) {
    if (lock.current) return;
    lock.current = true; setAdding(true);
    try {
      const notes: string[] = [];
      let room = MAX_FILES - itemsRef.current.length;
      for (const f of files) {
        if (room <= 0) { notes.push(`Лимит ${MAX_FILES} файлов`); break; }
        if (!/\.(mp4|mov|webm)$/i.test(f.name) && !/^video\/(mp4|quicktime|webm)$/.test(f.type)) { notes.push(`${f.name}: формат не поддерживается`); continue; }
        if (f.size > s.maxMB * 1048576) { notes.push(`${f.name}: больше ${s.maxMB} МБ`); continue; }
        setMsg(`Читаю метаданные: ${f.name}`);
        const it: Item = { id: uid(), file: f, dur: 0, w: 0, h: 0, status: 'pending', progress: 0 };
        try { const p = await probe(f); it.dur = p.dur; it.w = p.w; it.h = p.h; }
        catch (e) { it.status = 'error'; it.error = (e as Error).message; }
        setItems(l => [...l, it]); room--;
      }
      setMsg(notes.join('\n'));
    } finally { lock.current = false; setAdding(false); }
  }

  async function start() {
    if (lock.current) return;
    const todo = items.filter(i => i.w > 0 && i.status !== 'done' && i.status !== 'processing');
    if (!todo.length) return;
    const w: string[] = [];
    if (s.speed.on && s.speed.v !== 1) w.push('изменится скорость и длительность');
    if (s.ratio !== 'orig') w.push('изменится соотношение сторон (добавятся поля)');
    if (w.length && !confirm('Внимание: ' + w.join('; ') + '. Продолжить?')) return;
    lock.current = true; cancelled.current = false; setRunning(true); setMsg('');
    let wake: any = null;
    try { wake = await (navigator as any).wakeLock?.request('screen'); } catch { /* ignore */ }
    try {
      for (const it of todo) {
        if (cancelled.current) break;
        const used = itemsRef.current.reduce((a, i) => a + (i.out?.size || 0), 0);
        if (used > MAX_OUT_BYTES) {
          setMsg('Достигнут лимит памяти для готовых файлов (1 ГБ). Скачайте результаты, удалите их из очереди и запустите обработку снова.');
          break;
        }
        upd(it.id, { status: 'processing', progress: 0, error: undefined, out: undefined });
        try {
          const out = await proc.run(it.file, buildArgs(it.w, it.h, s), p => upd(it.id, { progress: p }));
          upd(it.id, { status: 'done', progress: 1, out });
        } catch (e) {
          if (cancelled.current) upd(it.id, { status: 'canceled', progress: 0 });
          else upd(it.id, { status: 'error', progress: 0, error: humanError(e) });
        }
      }
    } finally {
      try { await wake?.release(); } catch { /* ignore */ }
      lock.current = false; setRunning(false);
    }
  }
  const cancel = () => { cancelled.current = true; proc.cancel(); };
  const remove = (id: string) => { if (!lock.current) setItems(l => l.filter(i => i.id !== id)); };
  const clear = () => { if (!lock.current) setItems([]); };

  return (
    <div className="app">
      <h1>Mass Video Processor</h1>
      <p className="muted">Видео обрабатываются на вашем устройстве и никуда не отправляются. Держите экран включённым и телефон на зарядке.</p>
      <FileUploader onFiles={addFiles} disabled={running || adding} />
      {msg && <div className="err pre">{msg}</div>}
      <VideoQueue items={items} running={running || adding} onRemove={remove} onClear={clear} />
      <details><summary>Настройки обработки</summary><ProcessingSettings s={s} setS={setS} /></details>
      <details><summary>Профили</summary><ProfileManager s={s} setS={setS} /></details>
      <details open><summary>Результаты</summary><DownloadManager items={items} /></details>
      <ProgressPanel items={items} running={running} locked={adding} onStart={start} onCancel={cancel} />
    </div>
  );
}
