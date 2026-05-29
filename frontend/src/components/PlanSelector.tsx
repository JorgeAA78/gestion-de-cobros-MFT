interface Props {
    value: 'libre' | '3x';
    onChange: (plan: 'libre' | '3x') => void;
}

export default function PlanSelector({ value, onChange }: Props) {
    return (
        <div className="plan-selector">
            <input type="radio" name="plan" value="libre" id="planLibre"
                className="plan-radio" checked={value === 'libre'}
                onChange={() => onChange('libre')} />
            <label htmlFor="planLibre" className="plan-option">
                <span className="plan-icon">🔥</span>
                <span className="plan-name">Libre</span>
                <span className="plan-desc">Entrenamiento ilimitado todos los días</span>
            </label>

            <input type="radio" name="plan" value="3x" id="plan3x"
                className="plan-radio" checked={value === '3x'}
                onChange={() => onChange('3x')} />
            <label htmlFor="plan3x" className="plan-option">
                <span className="plan-icon">💪</span>
                <span className="plan-name">3 Veces por Semana</span>
                <span className="plan-desc">3 clases semanales a elección</span>
            </label>
        </div>
    );
}
