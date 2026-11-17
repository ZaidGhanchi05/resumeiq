import { useRef, useState } from 'react'
import { UploadCloud, FileText, X } from 'lucide-react'

/* Compact resume input: drop/browse a file OR paste text. Controlled by the parent. */
export default function ResumePicker({ file, setFile, text, setText, rows = 5 }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)
  const pick = (f) => { if (f) { setFile(f); setText('') } }
  return (
    <div>
      <div onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
        className={`flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 text-sm transition
          ${drag ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40'}`}>
        <input ref={ref} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => pick(e.target.files[0])} />
        {file ? (
          <span className="flex items-center gap-2 font-medium"><FileText size={18} className="text-brand-700" />{file.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }} className="rounded-full p-1 hover:bg-slate-100"><X size={13} /></button></span>
        ) : (<><UploadCloud size={20} className="text-brand-600" /><span><b>Drop a resume</b> or click to browse <span className="text-mute">(PDF, DOCX, TXT)</span></span></>)}
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setFile(null) }} rows={rows}
        placeholder="...or paste your resume text here"
        className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
    </div>
  )
}
