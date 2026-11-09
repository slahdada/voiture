import { ChevronLeft, ChevronRight, RotateCcw, Calendar } from "lucide-react";
import {
  type PeriodRange,
  type PeriodType,
  computePeriod,
  shiftPeriod,
  getTunisToday,
} from "./period";

interface Props {
  range: PeriodRange;
  onChange: (next: PeriodRange) => void;
  className?: string;
}

export function PeriodSelector({ range, onChange, className = "" }: Props) {
  const types: { id: PeriodType; label: string }[] = [
    { id: "day", label: "Jour" },
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "year", label: "Année" },
    { id: "custom", label: "Personnalisée" },
  ];

  function handleTypeChange(nextType: PeriodType) {
    if (nextType === range.type) return;
    if (nextType === "custom") {
      onChange(computePeriod("custom", range.start, range.end));
    } else {
      onChange(computePeriod(nextType, range.referenceDate || getTunisToday()));
    }
  }

  function handlePrev() {
    onChange(shiftPeriod(range, -1));
  }

  function handleNext() {
    onChange(shiftPeriod(range, 1));
  }

  function handleCurrent() {
    onChange(computePeriod(range.type, getTunisToday()));
  }

  function handleDayPick(val: string) {
    if (val) onChange(computePeriod("day", val));
  }

  function handleMonthPick(val: string) {
    // val is "YYYY-MM"
    if (val) {
      onChange(computePeriod("month", `${val}-01`));
    }
  }

  function handleYearPick(val: string) {
    if (val && /^\d{4}$/.test(val)) {
      onChange(computePeriod("year", `${val}-01-01`));
    }
  }

  function handleCustomStart(val: string) {
    if (!val) return;
    const end = range.end < val ? val : range.end;
    onChange(computePeriod("custom", val, end));
  }

  function handleCustomEnd(val: string) {
    if (!val) return;
    const start = val < range.start ? val : range.start;
    onChange(computePeriod("custom", start, val));
  }

  const isCurrentPeriod = (() => {
    const nowPeriod = computePeriod(range.type, getTunisToday());
    return range.start === nowPeriod.start && range.end === nowPeriod.end;
  })();

  const currentMonthValue = range.referenceDate.slice(0, 7);
  const currentYearValue = range.referenceDate.slice(0, 4);

  return (
    <div className={`period-selector-panel ${className}`}>
      <div className="period-tabs" role="tablist" aria-label="Type de période">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={range.type === t.id}
            className={`period-tab-btn ${range.type === t.id ? "active" : ""}`}
            onClick={() => handleTypeChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="period-nav-row">
        <div className="period-nav-controls">
          <button
            type="button"
            className="period-nav-btn"
            onClick={handlePrev}
            aria-label="Période précédente"
            title="Période précédente"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            className="period-nav-btn"
            onClick={handleNext}
            aria-label="Période suivante"
            title="Période suivante"
          >
            <ChevronRight size={18} />
          </button>

          {!isCurrentPeriod && (
            <button
              type="button"
              className="period-now-btn"
              onClick={handleCurrent}
              title="Revenir à la période actuelle"
            >
              <RotateCcw size={13} />
              <span>{range.type === "day" ? "Aujourd'hui" : "Période actuelle"}</span>
            </button>
          )}
        </div>

        <div className="period-label-badge" title={`Du ${range.start} au ${range.end}`}>
          <Calendar size={15} />
          <strong>{range.label}</strong>
          <small className="period-dates-subtext">({range.start} → {range.end})</small>
        </div>
      </div>

      {/* Date Pickers for Direct Selection */}
      <div className="period-pickers-row">
        {range.type === "day" && (
          <label className="period-inline-picker">
            <span>Choisir une date :</span>
            <input
              type="date"
              value={range.start}
              onChange={(e) => handleDayPick(e.target.value)}
              aria-label="Sélectionner une date précise"
            />
          </label>
        )}

        {range.type === "month" && (
          <label className="period-inline-picker">
            <span>Choisir un mois :</span>
            <input
              type="month"
              value={currentMonthValue}
              onChange={(e) => handleMonthPick(e.target.value)}
              aria-label="Sélectionner un mois précis"
            />
          </label>
        )}

        {range.type === "year" && (
          <label className="period-inline-picker">
            <span>Choisir une année :</span>
            <input
              type="number"
              min="1990"
              max="2100"
              value={currentYearValue}
              onChange={(e) => handleYearPick(e.target.value)}
              aria-label="Sélectionner une année précise"
              style={{ width: "95px" }}
            />
          </label>
        )}

        {range.type === "custom" && (
          <div className="period-custom-inputs">
            <label className="period-inline-picker">
              <span>Du :</span>
              <input
                type="date"
                value={range.start}
                max={range.end}
                onChange={(e) => handleCustomStart(e.target.value)}
                aria-label="Date de début personnalisée"
              />
            </label>
            <label className="period-inline-picker">
              <span>Au :</span>
              <input
                type="date"
                value={range.end}
                min={range.start}
                onChange={(e) => handleCustomEnd(e.target.value)}
                aria-label="Date de fin personnalisée"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
