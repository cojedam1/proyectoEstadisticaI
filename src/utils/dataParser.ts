import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ColumnMetadata, SurveyDataset, VariableType, VariableSubtype } from '../types/statistics';

// Helper to determine variable type and subtype
export function inferColumnType(values: any[]): { type: VariableType; subtype: VariableSubtype } {
  let numCount = 0;
  let textCount = 0;
  let totalValid = 0;
  const uniqueVals = new Set<string>();

  for (const v of values) {
    if (v === null || v === undefined || String(v).trim() === '') continue;
    totalValid++;
    const strVal = String(v).trim();
    uniqueVals.add(strVal);

    // Try parsing as number
    const cleanedStr = strVal.replace('+', '').trim();
    const num = typeof v === 'number' ? v : parseFloat(cleanedStr.replace(',', '.'));
    if (!isNaN(num) && isFinite(num) && !isNaN(Number(cleanedStr.replace(',', '.')))) {
      numCount++;
    } else {
      textCount++;
    }
  }

  if (totalValid === 0) {
    return { type: 'qualitative', subtype: 'nominal' };
  }

  const numericRatio = numCount / totalValid;

  if (numericRatio >= 0.8) {
    // Check if discrete or continuous
    let allIntegers = true;
    for (const v of values) {
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      if (!Number.isInteger(num)) {
        allIntegers = false;
        break;
      }
    }

    if (allIntegers && uniqueVals.size <= 15) {
      return { type: 'quantitative', subtype: 'discrete' };
    }
    return { type: 'quantitative', subtype: allIntegers ? 'discrete' : 'continuous' };
  } else {
    // Qualitative: check ordinal keywords
    const ordinalKeywords = [
      'bajo', 'medio', 'alto', 'muy alto', 'muy bajo',
      'nunca', 'a veces', 'frecuentemente', 'siempre',
      'malo', 'regular', 'bueno', 'excelente',
      'desacuerdo', 'acuerdo', 'neutral', 'poco', 'mucho'
    ];

    let hasOrdinalWords = false;
    for (const val of uniqueVals) {
      const lower = val.toLowerCase();
      if (ordinalKeywords.some(kw => lower.includes(kw))) {
        hasOrdinalWords = true;
        break;
      }
    }

    return { type: 'qualitative', subtype: hasOrdinalWords ? 'ordinal' : 'nominal' };
  }
}

// Parse Raw Array of Objects into SurveyDataset
export function processRawData(
  rawData: Record<string, any>[],
  fileName: string = 'encuesta_datos.xlsx',
  datasetName: string = 'Resultados de Encuesta'
): SurveyDataset {
  if (!rawData || rawData.length === 0) {
    throw new Error('El archivo no contiene registros o está vacío.');
  }

  const allHeaders = Object.keys(rawData[0]);
  const columns: ColumnMetadata[] = [];
  const totalRecords = rawData.length;

  for (const header of allHeaders) {
    const values = rawData.map(row => row[header]);
    let missingRows = 0;
    let invalidRows = 0;
    const uniqueValues = new Set<string>();

    for (const v of values) {
      if (v === null || v === undefined || String(v).trim() === '' || String(v).toLowerCase() === 'n/a') {
        missingRows++;
      } else {
        uniqueValues.add(String(v).trim());
      }
    }

    const validRows = totalRecords - missingRows;
    const { type, subtype } = inferColumnType(values);

    let displayName = header.trim();
    if (displayName.length > 80) {
      displayName = displayName.substring(0, 77) + '...';
    }

    columns.push({
      id: header,
      originalName: header,
      displayName: header.trim(),
      type,
      subtype,
      totalRows: totalRecords,
      validRows,
      missingRows,
      invalidRows,
      uniqueValuesCount: uniqueValues.size,
    });
  }

  const rowStrings = new Set<string>();
  let duplicateRowsCount = 0;
  for (const row of rawData) {
    const str = JSON.stringify(row);
    if (rowStrings.has(str)) {
      duplicateRowsCount++;
    } else {
      rowStrings.add(str);
    }
  }

  const cleanRecordsCount = totalRecords - duplicateRowsCount;

  return {
    name: datasetName,
    description: `Dataset procesado con ${totalRecords} respuestas y ${columns.length} variables.`,
    fileName,
    uploadedAt: new Date().toISOString(),
    columns,
    rows: rawData,
    totalRecords,
    cleanRecordsCount,
    duplicateRowsCount,
  };
}

// Parse XLSX / XLS / CSV from File Object
export async function parseFile(file: File): Promise<SurveyDataset> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            if (results.data && results.data.length > 0) {
              const dataset = processRawData(results.data as Record<string, any>[], file.name, file.name.replace(/\.[^/.]+$/, ''));
              resolve(dataset);
            } else {
              reject(new Error('El archivo CSV no contiene registros legibles.'));
            }
          } catch (err: any) {
            reject(err);
          }
        },
        error: (err) => {
          reject(new Error(`Error al leer archivo CSV: ${err.message}`));
        },
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, any>[];

          if (!jsonData || jsonData.length === 0) {
            reject(new Error('La hoja de cálculo está vacía o no tiene encabezados válidos.'));
            return;
          }

          const dataset = processRawData(jsonData, file.name, file.name.replace(/\.[^/.]+$/, ''));
          resolve(dataset);
        } catch (err: any) {
          reject(new Error(`Error al procesar archivo Excel: ${err.message}`));
        }
      };
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo en memoria.'));
      };
      reader.readAsArrayBuffer(file);
    });
  }
}
