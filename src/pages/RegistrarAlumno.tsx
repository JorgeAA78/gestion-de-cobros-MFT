import { useState, useRef, type FormEvent } from 'react';
import { useStore } from '../store/useStore';
import PlanSelector from '../components/PlanSelector';
import MonthGrid from '../components/MonthGrid';
import { showToast } from '../components/Toast';
import { formatWhatsApp, formatCurrency, sendWhatsApp } from '../services/evolution';
import { parseExcelFile } from '../services/spreadsheet';
import type { Alumno } from '../types';

export default function RegistrarAlumno() {
    const addAlumno = useStore((s) => s.addAlumno);
    const importAlumnos = useStore((s) => s.importAlumnos);
    const config = useStore((s) => s.config);
    const addActivity = useStore((s) => s.addActivity);
    const incrementMensajes = useStore((s) => s.incrementMensajes);
    const currentMonth = new Date().getMonth() + 1;

    const [nombre, setNombre] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [plan, setPlan] = useState<'libre' | '3x'>('libre');
    const [cuota, setCuota] = useState('');
    const [nivel, setNivel] = useState<Alumno['nivel']>('blanco');
    const [meses, setMeses] = useState<number[]>([currentMonth]);
    const [notas, setNotas] = useState('');
    const [diaVencimiento, setDiaVencimiento] = useState(new Date().getDate());
    const [loading, setLoading] = useState(false);

    // Import state
    const [showImport, setShowImport] = useState(false);
    const [importData, setImportData] = useState<Omit<Alumno, 'id' | 'fechaRegistro'>[]>([]);
    const [importFileName, setImportFileName] = useState('');
    const [importHeaders, setImportHeaders] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Columns the parser recognizes
    const KNOWN_COLS = ['nombre', 'name', 'alumno', 'nombre completo', 'apellido y nombre', 'nombre y apellido', 'nombre apellido', 'apellido', 'socio', 'cliente', 'estudiante', 'integrante', 'whatsapp', 'telefono', 'teléfono', 'tel', 'celular', 'phone', 'movil', 'móvil', 'contacto', 'numero', 'número', 'cel', 'num', 'tel/cel', 'email', 'correo', 'mail', 'plan', 'tipo de plan', 'categoria', 'categoría', 'modalidad', 'cuota', 'monto', 'precio', 'valor', 'importe', 'tarifa', 'mensualidad', 'nivel', 'cinturon', 'cinturón', 'belt', 'grado', 'faja', 'notas', 'observaciones', 'notes', 'comentarios', 'descripcion', 'obs'];

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const formatted = formatWhatsApp(whatsapp);
        addAlumno({
            nombre, whatsapp: formatted, email, plan, cuota: parseInt(cuota) || 0,
            nivel, notas, diaVencimiento,
        });

        addActivity('sent', `Alumno registrado: ${nombre} (${plan === 'libre' ? 'Libre' : '3x Semana'})`);

        if (config.evolutionApiUrl && config.evolutionApiKey && config.evolutionInstance) {
            const msg = `¡Hola ${nombre}! 🥋👊\n\nBienvenido/a a *Mutantes Fight Team*!\n\n📋 Plan: *${plan === 'libre' ? 'Libre' : '3 Veces por Semana'}*\n💰 Cuota: *${formatCurrency(parseInt(cuota))}*\n\n¡Nos vemos en el tatami! 💪🔥\n\n_Mutantes Fight Team - BJJ_`;
            const res = await sendWhatsApp(config.evolutionApiUrl, config.evolutionApiKey, config.evolutionInstance, formatted, msg);
            if (res.success) {
                showToast('✅ Alumno registrado y bienvenida enviada', 'success');
                incrementMensajes();
            } else {
                showToast(`🥋 Registrado. WhatsApp: ${res.error}`, 'warning');
            }
        } else {
            showToast('🥋 Alumno registrado exitosamente', 'success');
        }

        setNombre(''); setWhatsapp(''); setEmail(''); setPlan('libre');
        setCuota(''); setNivel('blanco'); setMeses([currentMonth]); setNotas('');
        setDiaVencimiento(new Date().getDate());
        setLoading(false);
    };

    const handleFileUpload = async (file: File) => {
        try {
            const result = await parseExcelFile(file);
            setImportData(result.mapped);
            setImportFileName(file.name);
            setImportHeaders(result.headers);
            if (result.mapped.length === 0) {
                showToast(`⚠️ 0 alumnos detectados. Revisá los nombres de columnas abajo.`, 'warning');
            } else {
                showToast(`📊 ${result.mapped.length} alumnos encontrados en ${file.name}`, 'success');
            }
        } catch (err: any) {
            showToast(`❌ Error: ${err.message}`, 'error');
        }
    };

    const confirmImport = () => {
        const count = importAlumnos(importData);
        addActivity('sent', `Importados ${count} alumnos desde ${importFileName}`);
        showToast(`✅ ${count} alumnos importados`, 'success');
        setImportData([]);
        setShowImport(false);
    };

    return (
        <>
            <div className="page-header">
                <h1>🥋 <span className="header-accent">Registrar Alumno</span></h1>
                <p>Agregá un nuevo alumno o importá desde un archivo Excel</p>
            </div>

            {/* Import Button */}
            <div style={{ marginBottom: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)' }}>
                <button className="btn btn-secondary" onClick={() => setShowImport(!showImport)}>
                    📄 {showImport ? 'Cerrar Import' : 'Importar desde Excel / CSV'}
                </button>
            </div>

            {/* Import Section */}
            {showImport && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 className="section-title">📄 Importar Alumnos</h3>
                    <p style={{ color: 'rgba(134,239,172,0.4)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
                        Subí un archivo <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong> con columnas: nombre, whatsapp, plan, cuota, nivel (opcionales: email, notas)
                    </p>

                    <div className="upload-area" onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('dragover');
                            const f = e.dataTransfer.files[0];
                            if (f) handleFileUpload(f);
                        }}>
                        <div className="upload-icon">📄</div>
                        <p><span className="upload-cta">Hacé clic</span> o arrastrá tu archivo Excel/CSV</p>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                            onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
                    </div>

                    {/* Column Diagnostics */}
                    {importHeaders.length > 0 && (
                        <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            <p style={{ fontSize: '0.8rem', color: 'rgba(134,239,172,0.5)', marginBottom: 8 }}>
                                📋 Columnas detectadas en tu archivo ({importHeaders.length}):
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {importHeaders.map((h, i) => {
                                    const recognized = KNOWN_COLS.includes(h.toLowerCase().trim());
                                    return (
                                        <span key={i} style={{
                                            padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                            background: recognized ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                                            color: recognized ? '#22c55e' : '#f59e0b',
                                            border: `1px solid ${recognized ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                        }}>
                                            {recognized ? '✓' : '?'} {h}
                                        </span>
                                    );
                                })}
                            </div>
                            {importData.length === 0 && (
                                <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#f59e0b' }}>
                                    ⚠️ Las columnas marcadas con <strong>?</strong> no fueron reconocidas. Renombralas según la tabla de columnas válidas.
                                </p>
                            )}
                        </div>
                    )}

                    {importData.length > 0 && (
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <p style={{ color: 'var(--accent-green)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                📊 {importData.length} alumnos listos para importar desde {importFileName}
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Nombre</th><th>WhatsApp</th><th>Plan</th><th>Cuota</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importData.slice(0, 10).map((a, i) => (
                                            <tr key={i}>
                                                <td>{i + 1}</td>
                                                <td>{a.nombre}</td>
                                                <td>{a.whatsapp}</td>
                                                <td>{a.plan === 'libre' ? '🔥 Libre' : '💪 3x'}</td>
                                                <td>{formatCurrency(a.cuota)}</td>
                                            </tr>
                                        ))}
                                        {importData.length > 10 && (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                                                ...y {importData.length - 10} más
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="btn-group">
                                <button className="btn btn-success btn-lg" onClick={confirmImport}>
                                    ✅ Importar {importData.length} Alumnos
                                </button>
                                <button className="btn btn-secondary" onClick={() => setImportData([])}>Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Manual Form */}
            <div className="form-container">
                <form className="card" onSubmit={handleSubmit}>
                    <h3 className="section-title">📝 Datos Personales</h3>

                    <div className="form-group">
                        <label>Nombre Completo <span className="required">*</span></label>
                        <input type="text" className="form-input" value={nombre}
                            onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>WhatsApp <span className="required">*</span></label>
                            <div className="input-group">
                                <span className="input-prefix">+54</span>
                                <input type="tel" className="form-input" value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)} placeholder="11 2345 6789" required />
                            </div>
                            <p className="form-hint">Número sin 0 ni 15, con código de área</p>
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" className="form-input" value={email}
                                onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" />
                        </div>
                    </div>

                    <h3 className="section-title mt-2">🥋 Plan de Entrenamiento</h3>
                    <div className="form-group">
                        <label>Seleccioná el Plan <span className="required">*</span></label>
                        <PlanSelector value={plan} onChange={setPlan} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Valor de Cuota <span className="required">*</span></label>
                            <div className="input-group">
                                <span className="input-prefix">$</span>
                                <input type="number" className="form-input" value={cuota}
                                    onChange={(e) => setCuota(e.target.value)} placeholder="25000" min="0" step="500" required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Cinturón</label>
                            <select className="form-select" value={nivel} onChange={(e) => setNivel(e.target.value as Alumno['nivel'])}>
                                <option value="blanco">⬜ Blanco</option>
                                <option value="gris">⚪ Gris</option>
                                <option value="amarillo">🟡 Amarillo</option>
                                <option value="azul">🟦 Azul</option>
                                <option value="morado">🟣 Morado / Púrpura</option>
                                <option value="marron">🟧 Marrón</option>
                                <option value="negro">⬛ Negro</option>
                            </select>
                        </div>
                    </div>

                    <h3 className="section-title mt-2">📅 Meses a Cobrar</h3>
                    <MonthGrid selected={meses} onChange={setMeses} />

                    <div className="form-group mt-2">
                        <label>Notas</label>
                        <textarea className="form-textarea" value={notas}
                            onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones, lesiones, horario..." />
                    </div>

                    <div className="form-group mt-2">
                        <label>📅 Día de Vencimiento de Cuota</label>
                        <input
                            type="number" className="form-input"
                            min={1} max={31}
                            value={diaVencimiento}
                            onChange={(e) => setDiaVencimiento(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        />
                        <p className="form-hint">
                            Día del mes en que se le enviará el recordatorio automático.
                            Se completa automáticamente con el día de hoy ({new Date().getDate()}).
                            Modificalo si el alumno tiene un vencimiento diferente al global.
                        </p>
                    </div>

                    <div className="btn-group">
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                            {loading ? '⏳ Registrando...' : '🥋 Registrar Alumno'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
