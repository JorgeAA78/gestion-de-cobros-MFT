import { MONTH_SHORT } from '../types';

interface Props {
    selected: number[];
    onChange: (months: number[]) => void;
}

export default function MonthGrid({ selected, onChange }: Props) {
    const toggle = (m: number) => {
        if (selected.includes(m)) onChange(selected.filter((x) => x !== m));
        else onChange([...selected, m]);
    };

    return (
        <div className="months-grid">
            {MONTH_SHORT.map((name, i) => {
                const num = i + 1;
                const checked = selected.includes(num);
                return (
                    <label key={num} className={`month-label ${checked ? 'checked' : ''}`}
                        style={checked ? {
                            background: 'rgba(34,197,94,0.15)',
                            borderColor: '#22c55e',
                            color: '#22c55e',
                            boxShadow: '0 0 8px rgba(34,197,94,0.35)',
                        } : undefined}>
                        <input type="checkbox" className="month-checkbox"
                            checked={checked} onChange={() => toggle(num)} />
                        {name}
                    </label>
                );
            })}
        </div>
    );
}
