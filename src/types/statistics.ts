export type VariableType = 'qualitative' | 'quantitative';
export type VariableSubtype = 'nominal' | 'ordinal' | 'discrete' | 'continuous';

export interface FrequencyRow {
  index: number;
  label: string;
  lowerBound?: number;
  upperBound?: number;
  classMark?: number; // xi
  absoluteFrequency: number; // fi
  cumulativeAbsolute: number; // Fi
  relativeFrequency: number; // hi
  cumulativeRelative: number; // Hi
  percentage: number; // %
  cumulativePercentage: number; // % Acumulado
}

export interface QualitativeStats {
  frequencies: FrequencyRow[];
  totalCount: number;
  validCount: number;
  missingCount: number;
  mode: string[];
  modeCount: number;
  diversityIndex: number;
  interpretation: string;
}

export type SkewnessType = 
  | 'Aproximadamente simétrica'
  | 'Asimétrica positiva (sesgo a la derecha)'
  | 'Asimétrica negativa (sesgo a la izquierda)';

export type KurtosisType = 
  | 'Leptocúrtica (distribución apuntada)'
  | 'Mesocúrtica (distribución normal/estándar)'
  | 'Platicúrtica (distribución aplanada)';

export type ModeType = 'unimodal' | 'bimodal' | 'multimodal' | 'amodal';

export interface QuantitativeStats {
  totalCount: number;
  validCount: number;
  missingCount: number;
  rawValues: number[];
  
  // Medidas de Tendencia Central
  mean: number;
  median: number;
  mode: number[];
  modeType: ModeType;
  modeFrequency: number;
  
  // Medidas de Dispersión
  range: number;
  sampleVariance: number;
  populationVariance: number;
  sampleStdDev: number;
  populationStdDev: number;
  coefficientOfVariation: number; // %
  interquartileRange: number; // RIC = Q3 - Q1
  meanAbsoluteDeviation: number;
  
  // Medidas de Posición
  min: number;
  max: number;
  q1: number; // Cuartil 1 (P25)
  q2: number; // Cuartil 2 (P50 / Mediana)
  q3: number; // Cuartil 3 (P75)
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  
  // Medidas de Forma
  skewness: number; // Coeficiente de asimetría de Fisher-Pearson
  skewnessType: SkewnessType;
  skewnessInterpretation: string;
  
  kurtosis: number; // Coeficiente de curtosis (exceso de curtosis)
  kurtosisType: KurtosisType;
  kurtosisInterpretation: string;
  
  // Valores Atípicos (Tukey)
  lowerOutlierLimit: number; // Q1 - 1.5 * RIC
  upperOutlierLimit: number; // Q3 + 1.5 * RIC
  lowerExtremeLimit: number; // Q1 - 3 * RIC
  upperExtremeLimit: number; // Q3 + 3 * RIC
  outliers: number[];
  outliersCount: number;
  
  // Distribución de Frecuencias No Agrupadas
  ungroupedFrequencies: FrequencyRow[];
  
  // Distribución de Frecuencias Agrupadas (Sturges)
  groupedFrequencies: FrequencyRow[];
  sturgesK: number;
  classWidth: number;
  groupedMean: number;
  groupedMedian: number;
  groupedMode: number;
  
  // Interpretación Integral
  interpretation: {
    centralTendency: string;
    variability: string;
    position: string;
    shapeAndOutliers: string;
    executiveSummary: string;
  };
}

export interface ColumnMetadata {
  id: string;
  originalName: string;
  displayName: string;
  type: VariableType;
  subtype: VariableSubtype;
  totalRows: number;
  validRows: number;
  missingRows: number;
  invalidRows: number;
  uniqueValuesCount: number;
  isCustomized?: boolean;
}

export interface SurveyDataset {
  name: string;
  description: string;
  fileName: string;
  uploadedAt: string;
  columns: ColumnMetadata[];
  rows: Record<string, any>[];
  totalRecords: number;
  cleanRecordsCount: number;
  duplicateRowsCount: number;
}
