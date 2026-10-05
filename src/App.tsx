import React, { useState, useRef } from 'react';
import { getDefaultSurveyDataset } from './data/defaultData';
import { parseFile } from './utils/dataParser';
import type { SurveyDataset, VariableType } from './types/statistics';
import { calculateQuantitativeStats, calculateQualitativeStats, roundTo } from './utils/statistics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  BarChart3,
  Printer,
  Table as TableIcon,
  Upload,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<SurveyDataset>(() => getDefaultSurveyDataset());
  const [activeTab, setActiveTab] = useState<'analysis' | 'table' | 'report'>('analysis');
  const [selectedColIndex, setSelectedColIndex] = useState<number>(1);
  const [useGroupedTable, setUseGroupedTable] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out pure timestamp metadata column
  const questionColumns = dataset.columns.filter(c => !c.originalName.toLowerCase().includes('marca temporal'));
  const activeCol = questionColumns[selectedColIndex - 1] || questionColumns[0];
  const rawValues = dataset.rows.map(r => r[activeCol.id]);

  const isQuantitative = activeCol.type === 'quantitative';
  const quantStats = isQuantitative ? calculateQuantitativeStats(rawValues) : null;
  const qualStats = !isQuantitative ? calculateQualitativeStats(rawValues) : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const parsed = await parseFile(e.target.files[0]);
        setDataset(parsed);
        setSelectedColIndex(1);
        setActiveTab('analysis');
      } catch (err: any) {
        alert(err.message || 'Error al procesar archivo');
      }
    }
  };

  const handleToggleType = (newType: VariableType) => {
    const updatedCols = dataset.columns.map(col => {
      if (col.id === activeCol.id) {
        return {
          ...col,
          type: newType,
          subtype: newType === 'quantitative' ? ('discrete' as const) : ('nominal' as const),
        };
      }
      return col;
    });

    setDataset({
      ...dataset,
      columns: updatedCols,
    });
  };

  // Chart setup
  const activeTable = isQuantitative
    ? (useGroupedTable ? quantStats?.groupedFrequencies : quantStats?.ungroupedFrequencies)
    : qualStats?.frequencies;

  const chartLabels = activeTable?.map(f => f.label) || [];
  const chartCounts = activeTable?.map(f => f.absoluteFrequency) || [];
  const chartPercents = activeTable?.map(f => f.percentage) || [];

  const barChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Frecuencia (fi)',
        data: chartCounts,
        backgroundColor: '#6366f1',
        borderColor: '#4f46e5',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="app-container">
      {/* 9.1 Entrada del sistema */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-title-box">
            <h1>Sistema Estadístico Automatizado — Estadística Descriptiva I</h1>
            <p>
              Archivo: <strong>{dataset.fileName}</strong> • Cantidad de registros procesados:{' '}
              <strong style={{ color: '#38bdf8' }}>{dataset.totalRecords} respuestas</strong>
            </p>
          </div>

          <div className="header-actions">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-upload"
            >
              <Upload size={14} />
              <span>Cargar Archivo (.xlsx / .csv)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="app-nav">
        <div className="nav-inner">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <BarChart3 size={15} />
            <span>Análisis por Pregunta ({questionColumns.length})</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <TableIcon size={15} />
            <span>Matriz de Respuestas ({dataset.totalRecords})</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            <Printer size={15} />
            <span>Informe Final Consolidado (PDF / Imprimir)</span>
          </button>
        </div>
      </nav>

      {/* Main Area */}
      <main className="main-wrapper">
        {/* TAB 1: PROCESAMIENTO ESTADISTICO POR PREGUNTA */}
        {activeTab === 'analysis' && (
          <div className="blocks-container">
            {/* 9.1.5 Selector de Preguntas */}
            <div className="question-selector">
              {questionColumns.map((col, idx) => {
                const isSelected = selectedColIndex === idx + 1;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColIndex(idx + 1)}
                    className={`question-btn ${isSelected ? 'active' : ''}`}
                  >
                    <span className={`q-badge ${col.type === 'quantitative' ? 'quant' : 'qual'}`}>
                      P{idx + 1} • {col.type === 'quantitative' ? 'Cuantitativa' : 'Cualitativa'}
                    </span>
                    <div className="q-title-truncate" title={col.displayName}>
                      {col.displayName}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 9.1.6 y 9.1.7 Banner de Variable, Tipo y Auditoría de Vacíos */}
            <div className="question-banner">
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 'bold' }}>
                  PREGUNTA {selectedColIndex} DE {questionColumns.length}
                </span>
                <h2>{activeCol.displayName}</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div className="audit-info-strip">
                  <span>Registros Válidos: <strong>{activeCol.validRows}</strong></span>
                  <span>Datos Vacíos / Errores: <strong style={{ color: activeCol.missingRows > 0 ? '#fbbf24' : '#34d399' }}>{activeCol.missingRows}</strong></span>
                </div>

                <div className="variable-type-switcher">
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tipo de variable:</span>
                  <select
                    value={activeCol.type}
                    onChange={(e) => handleToggleType(e.target.value as VariableType)}
                  >
                    <option value="quantitative">Cuantitativa</option>
                    <option value="qualitative">Cualitativa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 10.2 PROCESAMIENTO PARA VARIABLES CUANTITATIVAS */}
            {isQuantitative && quantStats && (
              <>
                {/* 10.2.B Medidas de Tendencia Central */}
                <div className="section-box">
                  <div className="section-header blue">
                    <span>10.2.B Medidas de Tendencia Central</span>
                  </div>
                  <div className="stat-chips-grid">
                    <div className="stat-chip">
                      <div className="stat-chip-label">Media Aritmética (x̄)</div>
                      <div className="stat-chip-val" style={{ color: '#818cf8' }}>{roundTo(quantStats.mean, 2)}</div>
                      <div className="stat-chip-sub">Promedio general</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Mediana (Me)</div>
                      <div className="stat-chip-val" style={{ color: '#fbbf24' }}>{roundTo(quantStats.median, 2)}</div>
                      <div className="stat-chip-sub">Punto medio (50%)</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Moda (Mo)</div>
                      <div className="stat-chip-val">
                        {quantStats.mode.length > 0 ? quantStats.mode.join(', ') : 'Amodal'}
                      </div>
                      <div className="stat-chip-sub">Valor más frecuente ({quantStats.modeFrequency} obs.)</div>
                    </div>
                  </div>
                </div>

                {/* 10.2.C Medidas de Variabilidad */}
                <div className="section-box">
                  <div className="section-header emerald">
                    <span>10.2.C Medidas de Variabilidad</span>
                  </div>
                  <div className="stat-chips-grid">
                    <div className="stat-chip">
                      <div className="stat-chip-label">Rango (R)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.range, 2)}</div>
                      <div className="stat-chip-sub">Máx - Mín</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Varianza (s²)</div>
                      <div className="stat-chip-val" style={{ color: '#34d399' }}>{roundTo(quantStats.sampleVariance, 2)}</div>
                      <div className="stat-chip-sub">Varianza muestral</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Desviación Estándar (s)</div>
                      <div className="stat-chip-val" style={{ color: '#34d399' }}>{roundTo(quantStats.sampleStdDev, 2)}</div>
                      <div className="stat-chip-sub">Dispersión respecto a media</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Coeficiente de Variación</div>
                      <div className="stat-chip-val" style={{ color: '#38bdf8' }}>{roundTo(quantStats.coefficientOfVariation, 1)}%</div>
                      <div className="stat-chip-sub">Variabilidad relativa</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Rango Intercuartílico (RIC)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.interquartileRange, 2)}</div>
                      <div className="stat-chip-sub">Q3 - Q1</div>
                    </div>
                  </div>
                </div>

                {/* 10.2.D Medidas de Posición */}
                <div className="section-box">
                  <div className="section-header sky">
                    <span>10.2.D Medidas de Posición</span>
                  </div>
                  <div className="stat-chips-grid">
                    <div className="stat-chip">
                      <div className="stat-chip-label">Valor Mínimo</div>
                      <div className="stat-chip-val">{quantStats.min}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Valor Máximo</div>
                      <div className="stat-chip-val">{quantStats.max}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Cuartil 1 (Q₁) / P25</div>
                      <div className="stat-chip-val">{roundTo(quantStats.q1, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Cuartil 2 (Q₂) / P50</div>
                      <div className="stat-chip-val">{roundTo(quantStats.q2, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Cuartil 3 (Q₃) / P75</div>
                      <div className="stat-chip-val">{roundTo(quantStats.q3, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Percentil 10 (P₁₀)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.p10, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Percentil 25 (P₂₅)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.p25, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Percentil 50 (P₅₀)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.p50, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Percentil 75 (P₇₅)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.p75, 2)}</div>
                    </div>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Percentil 90 (P₉₀)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.p90, 2)}</div>
                    </div>
                  </div>
                </div>

                {/* 10.2.E Medidas de Forma */}
                <div className="section-box">
                  <div className="section-header amber">
                    <span>10.2.E Medidas de Forma</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="stat-chip">
                      <div className="stat-chip-label">Coeficiente de Asimetría (g₁)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.skewness, 4)}</div>
                      <div style={{ marginTop: '6px' }}>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Clasificación según asimetría:</span><br />
                        <span className={`shape-badge ${quantStats.skewnessType === 'Aproximadamente simétrica' ? 'simetrica' : 'asimetrica'}`}>
                          {quantStats.skewnessType}
                        </span>
                      </div>
                    </div>

                    <div className="stat-chip">
                      <div className="stat-chip-label">Curtosis (g₂)</div>
                      <div className="stat-chip-val">{roundTo(quantStats.kurtosis, 4)}</div>
                      <div style={{ marginTop: '6px' }}>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Clasificación según curtosis:</span><br />
                        <span className="shape-badge curtosis">
                          {quantStats.kurtosisType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 10.2.A Distribución de Frecuencias y Sección 11 Gráfico */}
                <div className="table-chart-split">
                  {/* 10.2.A Tabla de Frecuencias */}
                  <div className="section-box">
                    <div className="section-header" style={{ color: '#ffffff' }}>
                      <span>10.2.A Distribución de Frecuencias</span>
                      <div className="toggle-btn-group">
                        <button
                          type="button"
                          className={`toggle-opt-btn ${!useGroupedTable ? 'active' : ''}`}
                          onClick={() => setUseGroupedTable(false)}
                        >
                          No Agrupada
                        </button>
                        <button
                          type="button"
                          className={`toggle-opt-btn ${useGroupedTable ? 'active' : ''}`}
                          onClick={() => setUseGroupedTable(true)}
                        >
                          Agrupada (Sturges)
                        </button>
                      </div>
                    </div>

                    <div className="freq-table-wrapper">
                      <table className="freq-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{useGroupedTable ? 'Intervalo [Li - Ls)' : 'Valor (xi)'}</th>
                            <th className="text-right">Frec. Absoluta (fi)</th>
                            <th className="text-right">Frec. Acumulada (Fi)</th>
                            <th className="text-right">Frec. Relativa (hi)</th>
                            <th className="text-right">Porcentaje (%)</th>
                            <th className="text-right">% Acum.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTable?.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ color: '#64748b' }}>{row.index}</td>
                              <td style={{ fontWeight: '600' }}>{row.label}</td>
                              <td className="text-right" style={{ color: '#818cf8', fontWeight: 'bold' }}>{row.absoluteFrequency}</td>
                              <td className="text-right" style={{ color: '#94a3b8' }}>{row.cumulativeAbsolute}</td>
                              <td className="text-right" style={{ fontFamily: 'monospace' }}>{row.relativeFrequency}</td>
                              <td className="text-right" style={{ color: '#34d399', fontWeight: 'bold' }}>{row.percentage}%</td>
                              <td className="text-right" style={{ color: '#94a3b8' }}>{row.cumulativePercentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}>TOTALES</td>
                            <td className="text-right" style={{ color: '#818cf8' }}>{quantStats.validCount}</td>
                            <td className="text-right">-</td>
                            <td className="text-right" style={{ fontFamily: 'monospace' }}>1.0000</td>
                            <td className="text-right" style={{ color: '#34d399' }}>100.0%</td>
                            <td className="text-right">-</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* 11. Gráfico Requerido */}
                  <div className="section-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="section-header" style={{ color: '#ffffff' }}>
                      <span>11. Gráfico Estadístico Requerido</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Frecuencias</span>
                    </div>

                    <div style={{ height: '260px', width: '100%' }}>
                      <Bar
                        data={barChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => ` ${ctx.formattedValue} respuestas (${chartPercents[ctx.dataIndex]}%)`
                              }
                            }
                          },
                          scales: {
                            y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } },
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Interpretación Breve */}
                <div className="interpretation-card">
                  <h4>Interpretación Estadística de los Resultados</h4>
                  <p>
                    {quantStats.interpretation.centralTendency} {quantStats.interpretation.variability} {quantStats.interpretation.shapeAndOutliers}
                  </p>
                </div>
              </>
            )}

            {/* 10.1 PROCESAMIENTO PARA VARIABLES CUALITATIVAS */}
            {!isQuantitative && qualStats && (
              <>
                <div className="table-chart-split">
                  {/* 10.1 Tabla de Frecuencias */}
                  <div className="section-box">
                    <div className="section-header blue">
                      <span>10.1 Tabla de Frecuencias (Variable Cualitativa)</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Total: {qualStats.validCount} respuestas</span>
                    </div>

                    <div className="freq-table-wrapper">
                      <table className="freq-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Categoría</th>
                            <th className="text-right">Frec. Absoluta (fi)</th>
                            <th className="text-right">Frec. Acumulada (Fi)</th>
                            <th className="text-right">Frec. Relativa (hi)</th>
                            <th className="text-right">Porcentaje (%)</th>
                            <th className="text-right">% Acum.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qualStats.frequencies.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ color: '#64748b' }}>{row.index}</td>
                              <td style={{ fontWeight: '600' }}>{row.label}</td>
                              <td className="text-right" style={{ color: '#818cf8', fontWeight: 'bold' }}>{row.absoluteFrequency}</td>
                              <td className="text-right" style={{ color: '#94a3b8' }}>{row.cumulativeAbsolute}</td>
                              <td className="text-right" style={{ fontFamily: 'monospace' }}>{row.relativeFrequency}</td>
                              <td className="text-right" style={{ color: '#34d399', fontWeight: 'bold' }}>{row.percentage}%</td>
                              <td className="text-right" style={{ color: '#94a3b8' }}>{row.cumulativePercentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}>TOTALES</td>
                            <td className="text-right" style={{ color: '#818cf8' }}>{qualStats.validCount}</td>
                            <td className="text-right">-</td>
                            <td className="text-right" style={{ fontFamily: 'monospace' }}>1.0000</td>
                            <td className="text-right" style={{ color: '#34d399' }}>100.0%</td>
                            <td className="text-right">-</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* 11. Gráfico Requerido */}
                  <div className="section-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="section-header blue">
                      <span>11. Gráfico Estadístico Apropiado</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Distribución de frecuencias</span>
                    </div>

                    <div style={{ height: '260px', width: '100%' }}>
                      <Bar
                        data={barChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => ` ${ctx.formattedValue} menciones (${chartPercents[ctx.dataIndex]}%)`
                              }
                            }
                          },
                          scales: {
                            y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } },
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 10.1 Interpretación Breve */}
                <div className="interpretation-card">
                  <h4>10.1 Interpretación Breve de Resultados</h4>
                  <p>{qualStats.interpretation}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: MATRIZ DE RESPUESTAS (9.1.4 y 9.1.5) */}
        {activeTab === 'table' && (
          <div className="section-box">
            <div className="section-header" style={{ color: '#ffffff' }}>
              <span>Matriz de Respuestas ({dataset.totalRecords} registros procesados)</span>
            </div>
            <div className="freq-table-wrapper" style={{ maxHeight: '600px' }}>
              <table className="freq-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {questionColumns.map(col => (
                      <th key={col.id} style={{ whiteSpace: 'nowrap' }}>
                        {col.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ color: '#64748b' }}>{rIdx + 1}</td>
                      {questionColumns.map(col => (
                        <td key={col.id} style={{ whiteSpace: 'nowrap' }}>
                          {String(row[col.id] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INFORME FINAL PARA IMPRIMIR */}
        {activeTab === 'report' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }} className="no-print">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Informe Consolidado</h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Documento completo con todas las secciones de evaluación</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-upload"
              >
                <Printer size={16} />
                <span>Imprimir / Guardar en PDF</span>
              </button>
            </div>

            <div className="report-sheet">
              <div className="report-header">
                <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>INFORME FINAL DE ESTADÍSTICA DESCRIPTIVA</h1>
                <h2 style={{ fontSize: '1rem', color: '#4f46e5', marginTop: '4px' }}>{dataset.name}</h2>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                  Muestra: <strong>n = {dataset.totalRecords} respuestas procesadas</strong> • Preguntas: {questionColumns.length}
                </div>
              </div>

              {questionColumns.map((col, idx) => {
                const colRaw = dataset.rows.map(r => r[col.id]);
                const isQ = col.type === 'quantitative';
                const qStat = isQ ? calculateQuantitativeStats(colRaw) : null;
                const cStat = !isQ ? calculateQualitativeStats(colRaw) : null;

                return (
                  <div key={col.id} className="report-item">
                    <div className="report-item-title">
                      Pregunta {idx + 1}: {col.displayName} ({isQ ? 'Cuantitativa' : 'Cualitativa'})
                    </div>

                    {isQ && qStat && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '6px', margin: '8px 0', fontSize: '0.72rem' }}>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Media (x̄):</span> <strong>{roundTo(qStat.mean, 2)}</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Mediana:</span> <strong>{roundTo(qStat.median, 2)}</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Moda:</span> <strong>{qStat.mode.join(', ') || 'Amodal'}</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Desv. Est. (s):</span> <strong>{roundTo(qStat.sampleStdDev, 2)}</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>CV:</span> <strong>{roundTo(qStat.coefficientOfVariation, 1)}%</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Asimetría:</span> <strong>{roundTo(qStat.skewness, 2)}</strong>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Curtosis:</span> <strong>{roundTo(qStat.kurtosis, 2)}</strong>
                        </div>
                      </div>
                    )}

                    <table className="report-mini-table">
                      <thead>
                        <tr>
                          <th>Categoría / Valor</th>
                          <th className="text-right">fi</th>
                          <th className="text-right">Fi</th>
                          <th className="text-right">hi</th>
                          <th className="text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isQ ? qStat?.ungroupedFrequencies : cStat?.frequencies)?.map((f, fIdx) => (
                          <tr key={fIdx}>
                            <td><strong>{f.label}</strong></td>
                            <td className="text-right">{f.absoluteFrequency}</td>
                            <td className="text-right">{f.cumulativeAbsolute}</td>
                            <td className="text-right">{f.relativeFrequency}</td>
                            <td className="text-right"><strong>{f.percentage}%</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ fontSize: '0.75rem', color: '#374151', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                      <strong>Interpretación:</strong>{' '}
                      {isQ && qStat ? (
                        <>
                          {qStat.interpretation.centralTendency} {qStat.interpretation.variability} {qStat.interpretation.shapeAndOutliers}
                        </>
                      ) : (
                        cStat?.interpretation
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
