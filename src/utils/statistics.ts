import type {
  FrequencyRow,
  QualitativeStats,
  QuantitativeStats,
  SkewnessType,
  KurtosisType,
  ModeType,
} from '../types/statistics';

// Helper to round numbers for display
export function roundTo(num: number, decimals: number = 2): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

// Percentile Calculation with Linear Interpolation (NIST / Standard Method)
export function calculatePercentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];

  const index = (sorted.length - 1) * (p / 100);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Calculate Qualitative Statistics
export function calculateQualitativeStats(rawValues: any[]): QualitativeStats {
  const cleanValues: string[] = [];
  let missingCount = 0;

  for (const v of rawValues) {
    if (v === null || v === undefined || String(v).trim() === '' || String(v).toLowerCase() === 'n/a' || String(v).toLowerCase() === 'null') {
      missingCount++;
    } else {
      cleanValues.push(String(v).trim());
    }
  }

  const validCount = cleanValues.length;
  const totalCount = rawValues.length;

  if (validCount === 0) {
    return {
      frequencies: [],
      totalCount,
      validCount: 0,
      missingCount,
      mode: ['Sin datos'],
      modeCount: 0,
      diversityIndex: 0,
      interpretation: 'No se encontraron datos válidos registrados para esta variable.',
    };
  }

  // Count Frequencies
  const freqMap = new Map<string, number>();
  for (const val of cleanValues) {
    freqMap.set(val, (freqMap.get(val) || 0) + 1);
  }

  // Sort by frequency descending
  const sortedEntries = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);

  let cumulativeAbs = 0;
  let maxFreq = 0;
  const modes: string[] = [];

  for (const [, count] of sortedEntries) {
    if (count > maxFreq) {
      maxFreq = count;
    }
  }

  for (const [label, count] of sortedEntries) {
    if (count === maxFreq) {
      modes.push(label);
    }
  }

  const frequencies: FrequencyRow[] = sortedEntries.map(([label, fi], idx) => {
    cumulativeAbs += fi;
    const hi = fi / validCount;
    const pi = hi * 100;
    const cumulativeRel = cumulativeAbs / validCount;
    const cumulativePerc = cumulativeRel * 100;

    return {
      index: idx + 1,
      label,
      absoluteFrequency: fi,
      cumulativeAbsolute: cumulativeAbs,
      relativeFrequency: roundTo(hi, 4),
      cumulativeRelative: roundTo(cumulativeRel, 4),
      percentage: roundTo(pi, 2),
      cumulativePercentage: roundTo(cumulativePerc, 2),
    };
  });

  // Calculate Shannon diversity index (normalized)
  let entropy = 0;
  for (const row of frequencies) {
    const p = row.absoluteFrequency / validCount;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = sortedEntries.length > 1 ? Math.log2(sortedEntries.length) : 1;
  const diversityIndex = maxEntropy > 0 ? roundTo((entropy / maxEntropy) * 100, 2) : 0;

  // Generate automated natural language interpretation
  const topCategory = frequencies[0];
  const secondCategory = frequencies.length > 1 ? frequencies[1] : null;

  let interpretation = `Se procesaron un total de ${validCount} respuestas válidas (${missingCount > 0 ? `${missingCount} valores omitidos/nulos` : '100% de tasa de completitud'}). `;
  if (modes.length === 1) {
    interpretation += `La categoría predominante o moda es "${topCategory.label}", con ${topCategory.absoluteFrequency} menciones, representando el ${topCategory.percentage}% del total de la muestra. `;
  } else {
    interpretation += `Se presenta una distribución multimodal empatada en las categorías ${modes.map(m => `"${m}"`).join(', ')} con ${maxFreq} respuestas cada una (${roundTo((maxFreq / validCount) * 100, 2)}%). `;
  }

  if (secondCategory && modes.length === 1) {
    interpretation += `En segundo lugar se ubica "${secondCategory.label}" con el ${secondCategory.percentage}% (${secondCategory.absoluteFrequency} casos). `;
  }

  if (frequencies.length > 3) {
    const cumulativeTop3 = frequencies.slice(0, 3).reduce((acc, r) => acc + r.percentage, 0);
    interpretation += `Las 3 principales opciones concentran en conjunto el ${roundTo(cumulativeTop3, 2)}% de todas las preferencias.`;
  }

  return {
    frequencies,
    totalCount,
    validCount,
    missingCount,
    mode: modes,
    modeCount: maxFreq,
    diversityIndex,
    interpretation,
  };
}

// Calculate Quantitative Statistics
export function calculateQuantitativeStats(
  rawValues: any[],
  customK?: number,
  customBinWidth?: number
): QuantitativeStats {
  const cleanNumbers: number[] = [];
  let missingCount = 0;

  for (const v of rawValues) {
    if (v === null || v === undefined || String(v).trim() === '') {
      missingCount++;
      continue;
    }
    const cleanStr = String(v).replace('+', '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const num = typeof v === 'number' ? v : parseFloat(cleanStr);
    if (!isNaN(num) && isFinite(num)) {
      cleanNumbers.push(num);
    } else {
      missingCount++;
    }
  }

  const validCount = cleanNumbers.length;
  const totalCount = rawValues.length;

  if (validCount === 0) {
    const emptyFreq: FrequencyRow[] = [];
    return {
      totalCount,
      validCount: 0,
      missingCount,
      rawValues: [],
      mean: 0,
      median: 0,
      mode: [0],
      modeType: 'amodal',
      modeFrequency: 0,
      range: 0,
      sampleVariance: 0,
      populationVariance: 0,
      sampleStdDev: 0,
      populationStdDev: 0,
      coefficientOfVariation: 0,
      interquartileRange: 0,
      meanAbsoluteDeviation: 0,
      min: 0,
      max: 0,
      q1: 0,
      q2: 0,
      q3: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      skewness: 0,
      skewnessType: 'Aproximadamente simétrica',
      skewnessInterpretation: 'Sin datos suficientes.',
      kurtosis: 0,
      kurtosisType: 'Mesocúrtica (distribución normal/estándar)',
      kurtosisInterpretation: 'Sin datos suficientes.',
      lowerOutlierLimit: 0,
      upperOutlierLimit: 0,
      lowerExtremeLimit: 0,
      upperExtremeLimit: 0,
      outliers: [],
      outliersCount: 0,
      ungroupedFrequencies: emptyFreq,
      groupedFrequencies: emptyFreq,
      sturgesK: 0,
      classWidth: 0,
      groupedMean: 0,
      groupedMedian: 0,
      groupedMode: 0,
      interpretation: {
        centralTendency: 'No hay datos cuantitativos disponibles para procesar.',
        variability: 'No hay datos cuantitativos disponibles para procesar.',
        position: 'No hay datos cuantitativos disponibles para procesar.',
        shapeAndOutliers: 'No hay datos cuantitativos disponibles para procesar.',
        executiveSummary: 'Sin registros numéricos válidos.',
      },
    };
  }

  // Sorted Array
  const sorted = [...cleanNumbers].sort((a, b) => a - b);
  const n = validCount;

  // Central Tendency
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const median = calculatePercentile(sorted, 50);

  // Modes
  const numFreqMap = new Map<number, number>();
  let maxFreq = 0;
  for (const val of sorted) {
    const c = (numFreqMap.get(val) || 0) + 1;
    numFreqMap.set(val, c);
    if (c > maxFreq) maxFreq = c;
  }

  let modes: number[] = [];
  let modeType: ModeType = 'unimodal';

  if (maxFreq === 1 && sorted.length > 1) {
    modeType = 'amodal';
    modes = [];
  } else {
    for (const [val, c] of numFreqMap.entries()) {
      if (c === maxFreq) modes.push(val);
    }
    modes.sort((a, b) => a - b);

    if (modes.length === 1) modeType = 'unimodal';
    else if (modes.length === 2) modeType = 'bimodal';
    else if (modes.length > 2 && modes.length < numFreqMap.size) modeType = 'multimodal';
    else modeType = 'amodal';
  }

  // Position Measures
  const min = sorted[0];
  const max = sorted[n - 1];
  const q1 = calculatePercentile(sorted, 25);
  const q2 = median;
  const q3 = calculatePercentile(sorted, 75);
  const p10 = calculatePercentile(sorted, 10);
  const p25 = q1;
  const p50 = q2;
  const p75 = q3;
  const p90 = calculatePercentile(sorted, 90);

  // Variability
  const range = max - min;
  const iqr = q3 - q1;

  let sumSqDiff = 0;
  let sumAbsDiff = 0;
  for (const x of sorted) {
    const diff = x - mean;
    sumSqDiff += diff * diff;
    sumAbsDiff += Math.abs(diff);
  }

  const sampleVariance = n > 1 ? sumSqDiff / (n - 1) : 0;
  const populationVariance = sumSqDiff / n;
  const sampleStdDev = Math.sqrt(sampleVariance);
  const populationStdDev = Math.sqrt(populationVariance);
  const cv = mean !== 0 ? Math.abs(sampleStdDev / mean) * 100 : 0;
  const meanAbsoluteDeviation = sumAbsDiff / n;

  // Shape Measures (Fisher-Pearson)
  let skewness = 0;
  let kurtosis = 0;

  if (n >= 3 && sampleStdDev > 0) {
    let m3 = 0;
    let m4 = 0;
    for (const x of sorted) {
      const z = (x - mean) / sampleStdDev;
      m3 += Math.pow(z, 3);
      m4 += Math.pow(z, 4);
    }

    // Adjusted Fisher-Pearson Skewness
    skewness = (n / ((n - 1) * (n - 2))) * m3;

    // Fisher excess kurtosis (sample corrected, 0 for normal distribution)
    if (n >= 4) {
      const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
      const factor2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
      kurtosis = factor1 * m4 - factor2;
    }
  }

  // Classify Skewness
  let skewnessType: SkewnessType = 'Aproximadamente simétrica';
  let skewnessInterpretation = '';
  if (skewness > 0.5) {
    skewnessType = 'Asimétrica positiva (sesgo a la derecha)';
    skewnessInterpretation = `La distribución presenta una cola extendida hacia los valores altos (coeficiente de asimetría g₁ = ${roundTo(skewness, 2)}). La media (${roundTo(mean, 2)}) es mayor que la mediana (${roundTo(median, 2)}), lo que indica que la mayor concentración de datos se encuentra en la parte baja de la escala con algunos valores elevados que aumentan el promedio.`;
  } else if (skewness < -0.5) {
    skewnessType = 'Asimétrica negativa (sesgo a la izquierda)';
    skewnessInterpretation = `La distribución presenta una cola extendida hacia los valores bajos (coeficiente de asimetría g₁ = ${roundTo(skewness, 2)}). La media (${roundTo(mean, 2)}) es menor que la mediana (${roundTo(median, 2)}), señalando que la mayoría de los encuestados se ubican en valores altos con unos pocos registros bajos que arrastran la media hacia abajo.`;
  } else {
    skewnessType = 'Aproximadamente simétrica';
    skewnessInterpretation = `La distribución es equilibrada y aproximadamente simétrica alrededor de su centro (coeficiente de asimetría g₁ = ${roundTo(skewness, 2)}), donde la media (${roundTo(mean, 2)}) y la mediana (${roundTo(median, 2)}) coinciden de forma estrecha.`;
  }

  // Classify Kurtosis
  let kurtosisType: KurtosisType = 'Mesocúrtica (distribución normal/estándar)';
  let kurtosisInterpretation = '';
  if (kurtosis > 0.5) {
    kurtosisType = 'Leptocúrtica (distribución apuntada)';
    kurtosisInterpretation = `Presenta una curva de alta concentración apuntada alrededor de la media (curtosis g₂ = ${roundTo(kurtosis, 2)}), reflejando una marcada homogeneidad en torno al valor central.`;
  } else if (kurtosis < -0.5) {
    kurtosisType = 'Platicúrtica (distribución aplanada)';
    kurtosisInterpretation = `Presenta una curva aplanada y dispersa (curtosis g₂ = ${roundTo(kurtosis, 2)}), lo que evidencia mayor heterogeneidad o dispersión de las respuestas a lo largo del rango de valores.`;
  } else {
    kurtosisType = 'Mesocúrtica (distribución normal/estándar)';
    kurtosisInterpretation = `Posee un grado de apuntamiento moderado similar al de una distribución normal (curtosis g₂ = ${roundTo(kurtosis, 2)}).`;
  }

  // Tukey Outliers
  const lowerOutlierLimit = q1 - 1.5 * iqr;
  const upperOutlierLimit = q3 + 1.5 * iqr;
  const lowerExtremeLimit = q1 - 3 * iqr;
  const upperExtremeLimit = q3 + 3 * iqr;

  const outliers: number[] = [];
  for (const x of sorted) {
    if (x < lowerOutlierLimit || x > upperOutlierLimit) {
      outliers.push(x);
    }
  }

  // Ungrouped Frequency Table
  const ungroupedMap = new Map<number, number>();
  for (const x of sorted) {
    ungroupedMap.set(x, (ungroupedMap.get(x) || 0) + 1);
  }
  const ungroupedKeys = Array.from(ungroupedMap.keys()).sort((a, b) => a - b);
  let cumAbsUngrouped = 0;
  const ungroupedFrequencies: FrequencyRow[] = ungroupedKeys.map((val, idx) => {
    const fi = ungroupedMap.get(val)!;
    cumAbsUngrouped += fi;
    const hi = fi / n;
    const pi = hi * 100;
    const cumHi = cumAbsUngrouped / n;
    const cumPi = cumHi * 100;

    return {
      index: idx + 1,
      label: String(val),
      classMark: val,
      absoluteFrequency: fi,
      cumulativeAbsolute: cumAbsUngrouped,
      relativeFrequency: roundTo(hi, 4),
      cumulativeRelative: roundTo(cumHi, 4),
      percentage: roundTo(pi, 2),
      cumulativePercentage: roundTo(cumPi, 2),
    };
  });

  // Grouped Frequency Table (Sturges Rule)
  const sturgesKRaw = 1 + 3.322 * Math.log10(n);
  const sturgesK = customK || Math.max(3, Math.min(15, Math.ceil(sturgesKRaw)));
  
  // Class width
  let classWidth = customBinWidth || (range === 0 ? 1 : range / sturgesK);
  if (!customBinWidth) {
    if (classWidth > 1) {
      classWidth = Math.ceil(classWidth * 10) / 10;
    } else {
      classWidth = Math.ceil(classWidth * 100) / 100;
    }
    if (classWidth === 0) classWidth = 1;
  }

  const groupedFrequencies: FrequencyRow[] = [];
  let currentLower = min;
  let cumAbsGrouped = 0;

  for (let i = 0; i < sturgesK; i++) {
    const lower = roundTo(currentLower, 2);
    let upper = roundTo(currentLower + classWidth, 2);
    const isLast = i === sturgesK - 1;
    if (isLast && upper < max) {
      upper = roundTo(max + 0.001, 2);
    }

    let countInBin = 0;
    for (const val of sorted) {
      if (isLast) {
        if (val >= lower && val <= upper) countInBin++;
      } else {
        if (val >= lower && val < upper) countInBin++;
      }
    }

    cumAbsGrouped += countInBin;
    const hi = countInBin / n;
    const pi = hi * 100;
    const cumHi = cumAbsGrouped / n;
    const cumPi = cumHi * 100;
    const classMark = roundTo((lower + upper) / 2, 2);

    groupedFrequencies.push({
      index: i + 1,
      label: `[${lower} - ${upper}${isLast ? ']' : ')'}`,
      lowerBound: lower,
      upperBound: upper,
      classMark,
      absoluteFrequency: countInBin,
      cumulativeAbsolute: cumAbsGrouped,
      relativeFrequency: roundTo(hi, 4),
      cumulativeRelative: roundTo(cumHi, 4),
      percentage: roundTo(pi, 2),
      cumulativePercentage: roundTo(cumPi, 2),
    });

    currentLower = upper;
  }

  // Grouped Mean: sum(fi * xi) / n
  let sumFiXi = 0;
  for (const bin of groupedFrequencies) {
    sumFiXi += bin.absoluteFrequency * (bin.classMark || 0);
  }
  const groupedMean = roundTo(sumFiXi / n, 2);

  // Grouped Median
  const halfN = n / 2;
  let medianBin = groupedFrequencies[0];
  let prevCumFi = 0;
  for (let i = 0; i < groupedFrequencies.length; i++) {
    if (groupedFrequencies[i].cumulativeAbsolute >= halfN) {
      medianBin = groupedFrequencies[i];
      prevCumFi = i > 0 ? groupedFrequencies[i - 1].cumulativeAbsolute : 0;
      break;
    }
  }
  const groupedMedian = medianBin.absoluteFrequency > 0
    ? roundTo((medianBin.lowerBound || 0) + ((halfN - prevCumFi) / medianBin.absoluteFrequency) * classWidth, 2)
    : median;

  // Grouped Mode
  let maxGroupFi = 0;
  let modalBinIdx = 0;
  for (let i = 0; i < groupedFrequencies.length; i++) {
    if (groupedFrequencies[i].absoluteFrequency > maxGroupFi) {
      maxGroupFi = groupedFrequencies[i].absoluteFrequency;
      modalBinIdx = i;
    }
  }
  const modalBin = groupedFrequencies[modalBinIdx];
  const fMo = modalBin.absoluteFrequency;
  const fMoPrev = modalBinIdx > 0 ? groupedFrequencies[modalBinIdx - 1].absoluteFrequency : 0;
  const fMoNext = modalBinIdx < groupedFrequencies.length - 1 ? groupedFrequencies[modalBinIdx + 1].absoluteFrequency : 0;
  const delta1 = fMo - fMoPrev;
  const delta2 = fMo - fMoNext;
  const groupedMode = (delta1 + delta2) > 0
    ? roundTo((modalBin.lowerBound || 0) + (delta1 / (delta1 + delta2)) * classWidth, 2)
    : (modalBin.classMark || 0);

  // Natural Language Statistical Interpretations
  const cvDescription = cv < 10 
    ? `muy baja (${roundTo(cv, 1)}%), lo que denota una muestra sumamente homogénea con baja dispersión relativa.`
    : cv <= 30
    ? `moderada (${roundTo(cv, 1)}%), mostrando una dispersión típica representativa alrededor de la media.`
    : `alta (${roundTo(cv, 1)}%), indicando una notable heterogeneidad y variabilidad entre los encuestados.`;

  const centralTendencyInterp = `El valor promedio obtenido es de media x̄ = ${roundTo(mean, 2)}, con una mediana de Me = ${roundTo(median, 2)} (el 50% de los encuestados se sitúa en o por debajo de este valor). ${
    modeType === 'unimodal'
      ? `La moda es de Mo = ${modes[0]}, siendo el valor más repetido con una frecuencia de ${maxFreq} observaciones (${roundTo((maxFreq / n) * 100, 1)}%).`
      : modeType === 'bimodal'
      ? `Se identificó una distribución bimodal en los valores ${modes.join(' y ')}, ambos con ${maxFreq} repeticiones.`
      : modeType === 'multimodal'
      ? `Se detectaron múltiples picos modales en los valores ${modes.join(', ')}.`
      : `No existe un valor modal único (distribución amodal/uniforme).`
  }`;

  const variabilityInterp = `Los valores oscilan entre un mínimo de ${min} y un máximo de ${max}, generando un rango de R = ${roundTo(range, 2)}. La desviación estándar muestral es de s = ${roundTo(sampleStdDev, 2)} (varianza muestral s² = ${roundTo(sampleVariance, 2)}), con un coeficiente de variación CV = ${roundTo(cv, 1)}%. Esto refleja una dispersión ${cvDescription} El rango intercuartílico es de RIC = ${roundTo(iqr, 2)} unidades.`;

  const positionInterp = `El primer cuartil (Q₁ / P₂₅) es de ${roundTo(q1, 2)}, indicando que el 25% de los datos es menor o igual a este valor. El 50% central de la muestra se encuentra comprendido entre Q₁ = ${roundTo(q1, 2)} y Q₃ = ${roundTo(q3, 2)}. El 10% inferior se sitúa por debajo de P₁₀ = ${roundTo(p10, 2)} y el 10% superior supera P₉₀ = ${roundTo(p90, 2)}.`;

  const shapeAndOutliersInterp = `${skewnessInterpretation} ${kurtosisInterpretation} ${
    outliers.length > 0
      ? `Mediante la regla de 1.5×RIC de Tukey se identificaron ${outliers.length} valores atípicos fuera del intervalo [${roundTo(lowerOutlierLimit, 2)}, ${roundTo(upperOutlierLimit, 2)}]: ${outliers.slice(0, 5).join(', ')}${outliers.length > 5 ? '...' : ''}.`
      : `No se identificaron valores atípicos según los límites de Tukey [${roundTo(lowerOutlierLimit, 2)}, ${roundTo(upperOutlierLimit, 2)}].`
  }`;

  const executiveSummary = `Variable cuantitativa procesada sobre ${n} observaciones válidas. Media = ${roundTo(mean, 2)}, Mediana = ${roundTo(median, 2)}, Desv. Est. = ${roundTo(sampleStdDev, 2)}, CV = ${roundTo(cv, 1)}%. Distribución ${skewnessType.toLowerCase()} y ${kurtosisType.toLowerCase()}.`;

  return {
    totalCount,
    validCount: n,
    missingCount,
    rawValues: sorted,
    mean: roundTo(mean, 4),
    median: roundTo(median, 4),
    mode: modes,
    modeType,
    modeFrequency: maxFreq,
    range: roundTo(range, 4),
    sampleVariance: roundTo(sampleVariance, 4),
    populationVariance: roundTo(populationVariance, 4),
    sampleStdDev: roundTo(sampleStdDev, 4),
    populationStdDev: roundTo(populationStdDev, 4),
    coefficientOfVariation: roundTo(cv, 2),
    interquartileRange: roundTo(iqr, 4),
    meanAbsoluteDeviation: roundTo(meanAbsoluteDeviation, 4),
    min,
    max,
    q1: roundTo(q1, 4),
    q2: roundTo(q2, 4),
    q3: roundTo(q3, 4),
    p10: roundTo(p10, 4),
    p25: roundTo(p25, 4),
    p50: roundTo(p50, 4),
    p75: roundTo(p75, 4),
    p90: roundTo(p90, 4),
    skewness: roundTo(skewness, 4),
    skewnessType,
    skewnessInterpretation,
    kurtosis: roundTo(kurtosis, 4),
    kurtosisType,
    kurtosisInterpretation,
    lowerOutlierLimit: roundTo(lowerOutlierLimit, 2),
    upperOutlierLimit: roundTo(upperOutlierLimit, 2),
    lowerExtremeLimit: roundTo(lowerExtremeLimit, 2),
    upperExtremeLimit: roundTo(upperExtremeLimit, 2),
    outliers,
    outliersCount: outliers.length,
    ungroupedFrequencies,
    groupedFrequencies,
    sturgesK,
    classWidth: roundTo(classWidth, 2),
    groupedMean,
    groupedMedian,
    groupedMode,
    interpretation: {
      centralTendency: centralTendencyInterp,
      variability: variabilityInterp,
      position: positionInterp,
      shapeAndOutliers: shapeAndOutliersInterp,
      executiveSummary,
    },
  };
}
