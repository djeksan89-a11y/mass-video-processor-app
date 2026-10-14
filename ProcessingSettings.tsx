import { EFFECTS } from './settings';
import type { EffKey, Settings } from './types';
export default function ProcessingSettings({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const eff = (k: EffKey, p: Partial<{ on: boolean; v: number }>) => setS({ ...s, [k]: { ...s[k], ...p } });
  return (
    <div>
      {EFFECTS.map(e => (
        <div key={e.k} className="eff">
          <label className="row"><span>{e.label}{e.slider && s[e.k].on ? `: ${s[e.k].v}` : ''}</span>
            <input type="checkbox" checked={s[e.k].on} onChange={x => eff(e.k, { on: x.target.checked })} /></label>
          {e.slider && s[e.k].on && <input type="range" min={e.min} max={e.max} step={e.step} value={s[e.k].v} onChange={x => eff(e.k, { v: +x.target.value })} />}
        </div>
      ))}
      <label>Соотношение сторон (без обрезки, добавляются чёрные поля)
        <select value={s.ratio} onChange={e => setS({ ...s, ratio: e.target.value })}>
          <option value="orig">Оригинальное</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:5">4:5</option>
        </select></label>
      <label>Разрешение (длинная сторона)
        <select value={s.maxLong} onChange={e => setS({ ...s, maxLong: +e.target.value })}>
          <option value={0}>Как в оригинале</option><option value={1920}>1920</option><option value={1280}>1280</option><option value={854}>854</option>
        </select></label>
      <label>Качество
        <select value={s.crf} onChange={e => setS({ ...s, crf: +e.target.value })}>
          <option value={20}>Высокое (большой файл)</option><option value={24}>Среднее</option><option value={28}>Компактное</option>
        </select></label>
      <label>Макс. размер одного файла, МБ
        <input type="number" min={10} max={1000} value={s.maxMB} onChange={e => setS({ ...s, maxMB: Math.max(10, +e.target.value || 300) })} /></label>
    </div>
  );
}
