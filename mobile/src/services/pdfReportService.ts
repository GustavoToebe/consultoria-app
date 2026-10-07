import * as Print from 'expo-print';
import { SavedExecutionLog } from '../database/storage';
import { SARAIVA_PDF_SCHEDULE } from '../database/pdf_plan_parser';

export type ReportGroupingMode = 'chronological' | 'by_exercise' | 'by_division';

export interface ReportFolderData {
  folderId?: string;
  name: string;
  startDate: string;
  endDate: string;
  logs: SavedExecutionLog[];
  groupingMode?: ReportGroupingMode;
}

export async function generateAndSharePdfReport(data: ReportFolderData): Promise<void> {
  const { name, startDate, endDate, logs, groupingMode = 'by_division' } = data;

  // Lista oficial de exercícios que pertencem exclusivamente ao Plano 16 do Saraiva Team
  const officialPlanExerciseNames = new Set<string>();
  SARAIVA_PDF_SCHEDULE.forEach(day => {
    day.exercises.forEach(ex => {
      officialPlanExerciseNames.add(ex.name.trim().toLowerCase());
    });
  });

  // 1. Filtra estritamente os logs que pertencem a este período, plano e aos exercícios oficiais do Plano
  const validLogs = logs
    .filter(l => {
      if (data.folderId && l.folderId && l.folderId !== data.folderId) return false;
      const withinDate = l.date >= startDate && l.date <= endDate;
      if (!withinDate) return false;

      // Se for plano oficial (Plano 16), elimina exercícios que não fazem parte dele (ex: T bar row da planilha conceitual)
      if (name.toLowerCase().includes('plano 16')) {
        return officialPlanExerciseNames.has(l.exerciseName.trim().toLowerCase());
      }

      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  let tablesHtml = '';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBrDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

const DOW_ORDER: Record<string, number> = {
  'segunda': 1,
  'terça': 2,
  'terca': 2,
  'quarta': 3,
  'quinta': 4,
  'sexta': 5,
  'sábado': 6,
  'sabado': 6,
  'domingo': 7,
};

  if (validLogs.length === 0) {
    tablesHtml = `
      <div style="background-color: #161619; border: 1px solid #27272A; border-radius: 8px; padding: 32px; text-align: center; color: #9E9EA4; font-size: 13px;">
        Nenhum registro de carga salvo para o <strong>${name}</strong> no período de ${startDate} até ${endDate}.
      </div>
    `;
  } else if (groupingMode === 'by_division') {
    // AGRUPAMENTO SOLICITADO:
    // Nível 1: Divisão (ex: Segunda - Costas)
    // Nível 2: Exercício (ex: Remada baixa na polia unilateral)
    // Nível 3: Datas e Progressão (05/10/2026, 12/10/2026...)

    // 1. Mapeia divisões -> exercícios -> logs
    const divisionsMap = new Map<string, Map<string, SavedExecutionLog[]>>();

    validLogs.forEach(l => {
      const divRaw = l.divisionCode || 'Geral';
      if (!divisionsMap.has(divRaw)) {
        divisionsMap.set(divRaw, new Map());
      }
      const exMap = divisionsMap.get(divRaw)!;
      if (!exMap.has(l.exerciseName)) {
        exMap.set(l.exerciseName, []);
      }
      exMap.get(l.exerciseName)!.push(l);
    });

    // 2. Ordena as divisões na ordem cronológica da semana (Segunda a Domingo)
    const sortedDivisions = Array.from(divisionsMap.entries()).sort((a, b) => {
      const orderA = DOW_ORDER[a[0].toLowerCase()] || 99;
      const orderB = DOW_ORDER[b[0].toLowerCase()] || 99;
      return orderA - orderB;
    });

    sortedDivisions.forEach(([divName, exerciseMap]) => {
      // Descobre o foco da divisão a partir do cronograma oficial (ex: Costas, Peito + Ombros)
      const scheduleMatch = SARAIVA_PDF_SCHEDULE.find(
        s => s.dayName.toLowerCase() === divName.toLowerCase()
      );
      const divisionFullTitle = scheduleMatch 
        ? `${divName} - ${scheduleMatch.focus}` 
        : divName;

      tablesHtml += `
        <div style="margin-bottom: 30px;">
          <!-- NÍVEL 1: DIVISÃO (Segunda - Costas) -->
          <div style="background-color: #1A1A1E; border-left: 5px solid #C62828; padding: 10px 16px; border-radius: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #FFFFFF; font-size: 15px; font-weight: 900; letter-spacing: 0.8px;">${divisionFullTitle.toUpperCase()}</span>
            <span style="color: #9E9EA4; font-size: 11px; font-weight: 600;">${exerciseMap.size} exercício(s)</span>
          </div>

          <!-- NÍVEL 2: EXERCÍCIOS DA DIVISÃO -->
          ${Array.from(exerciseMap.entries()).map(([exName, exLogs]) => `
            <div style="margin-bottom: 16px; background-color: #161619; border: 1px solid #27272A; border-radius: 8px; overflow: hidden;">
              <!-- TÍTULO DO EXERCÍCIO -->
              <div style="background-color: #202024; padding: 9px 14px; border-bottom: 1px solid #27272A; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #F5F5F5; font-size: 13px; font-weight: 800;">${exName}</span>
                <span style="color: #9E9EA4; font-size: 10px; font-weight: 600;">${exLogs.length} sessão(ões)</span>
              </div>

              <!-- NÍVEL 3: DATAS E EVOLUÇÃO DAS CARGAS -->
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #161619; border-bottom: 1px solid #27272A;">
                    <th style="width: 18%; padding: 8px 12px; text-align: left; font-size: 10px; color: #9E9EA4;">DATA</th>
                    <th style="width: 20%; padding: 8px 12px; text-align: right; font-size: 10px; color: #9E9EA4;">WORKING SET</th>
                    <th style="width: 14%; padding: 8px 12px; text-align: center; font-size: 10px; color: #9E9EA4;">REPS</th>
                    <th style="width: 14%; padding: 8px 12px; text-align: center; font-size: 10px; color: #9E9EA4;">RIR</th>
                    <th style="width: 34%; padding: 8px 12px; text-align: left; font-size: 10px; color: #9E9EA4;">OBSERVAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  ${exLogs.sort((a, b) => a.date.localeCompare(b.date)).map(l => `
                    <tr style="border-bottom: 1px solid #202024;">
                      <td style="padding: 10px 12px; color: #F5F5F5; font-size: 11px; font-weight: 700;">${formatBrDate(l.date)}</td>
                      <td style="padding: 10px 12px; color: #C62828; font-size: 13px; font-weight: 900; text-align: right;">${l.workingSetWeight} kg</td>
                      <td style="padding: 10px 12px; color: #F5F5F5; font-size: 11px; text-align: center; font-weight: 600;">${l.completedReps} reps</td>
                      <td style="padding: 10px 12px; color: #9E9EA4; font-size: 11px; text-align: center;">${l.rir !== undefined ? `${l.rir} RIR` : 'Falha'}</td>
                      <td style="padding: 10px 12px; color: #E4E4E7; font-size: 10px;">
                        ${l.notes && l.notes.trim() ? `
                          <div style="background-color: #1F1F24; padding: 4px 8px; border-left: 2px solid #EAB308; border-radius: 3px; font-style: italic; line-height: 1.3;">
                            <strong style="color: #FACC15; font-style: normal;">Obs:</strong> ${escapeHtml(l.notes.trim())}
                          </div>
                        ` : '<span style="color: #52525B;">-</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      `;
    });
  } else if (groupingMode === 'by_exercise') {
    // AGRUPAMENTO POR EXERCÍCIO (Visualiza a evolução semana a semana da mesma carga)
    const exerciseMap = new Map<string, SavedExecutionLog[]>();
    validLogs.forEach(l => {
      if (!exerciseMap.has(l.exerciseName)) {
        exerciseMap.set(l.exerciseName, []);
      }
      exerciseMap.get(l.exerciseName)!.push(l);
    });

    exerciseMap.forEach((exLogs, exName) => {
      tablesHtml += `
        <div style="margin-bottom: 20px;">
          <div style="background-color: #202024; border-left: 4px solid #C62828; padding: 8px 12px; border-radius: 4px; margin-bottom: 6px;">
            <span style="color: #F5F5F5; font-size: 13px; font-weight: 800;">${exName}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">DATA</th>
                <th style="width: 20%;">DIVISÃO</th>
                <th style="width: 25%; text-align: right;">WORKING SET</th>
                <th style="width: 15%; text-align: center;">REPS</th>
                <th style="width: 20%; text-align: center;">OBSERVAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              ${exLogs.map(l => `
                <tr style="border-bottom: 1px solid #27272A;">
                  <td style="padding: 9px 8px; vertical-align: top; color: #9E9EA4; font-size: 11px;">${l.date}</td>
                  <td style="padding: 9px 8px; vertical-align: top; color: #F5F5F5; font-size: 11px;">${l.divisionCode}</td>
                  <td style="padding: 9px 8px; vertical-align: top; color: #C62828; font-size: 13px; font-weight: 800; text-align: right;">${l.workingSetWeight} kg</td>
                  <td style="padding: 9px 8px; vertical-align: top; color: #F5F5F5; font-size: 11px; text-align: center;">${l.completedReps} reps</td>
                  <td style="padding: 9px 8px; vertical-align: top; color: #E4E4E7; font-size: 10px; font-style: italic;">
                    ${l.notes && l.notes.trim() ? `
                      <span style="color: #FACC15;">•</span> ${escapeHtml(l.notes.trim())}
                    ` : '<span style="color: #52525B;">-</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });
  } else {
    // CRONOLÓGICO DIRETO
    tablesHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">DATA</th>
            <th style="width: 15%; text-align: center;">DIVISÃO</th>
            <th style="width: 40%;">EXERCÍCIO & OBSERVAÇÃO</th>
            <th style="width: 15%; text-align: right;">WORKING SET</th>
            <th style="width: 15%; text-align: center;">REPS</th>
          </tr>
        </thead>
        <tbody>
          ${validLogs.map(l => `
            <tr style="border-bottom: 1px solid #27272A;">
              <td style="padding: 9px 8px; vertical-align: top; color: #9E9EA4; font-size: 11px;">${l.date}</td>
              <td style="padding: 9px 8px; vertical-align: top; color: #F5F5F5; font-size: 11px; text-align: center; font-weight: bold;">${l.divisionCode}</td>
              <td style="padding: 9px 8px; vertical-align: top; color: #F5F5F5; font-size: 12px;">
                <div style="font-weight: bold;">${l.exerciseName}</div>
                ${l.notes && l.notes.trim() ? `
                  <div style="margin-top: 4px; padding: 4px 6px; background-color: #1A1A1E; border-left: 2px solid #EAB308; border-radius: 2px; color: #E4E4E7; font-size: 10px; font-style: italic;">
                    Obs: ${escapeHtml(l.notes.trim())}
                  </div>
                ` : ''}
              </td>
              <td style="padding: 9px 8px; vertical-align: top; color: #C62828; font-size: 13px; font-weight: 800; text-align: right;">${l.workingSetWeight} kg</td>
              <td style="padding: 9px 8px; vertical-align: top; color: #F5F5F5; font-size: 11px; text-align: center;">${l.completedReps} reps</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Treino - ${name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0B0B0D;
            color: #F5F5F5;
            padding: 24px;
            margin: 0;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #C62828;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .title {
            color: #C62828;
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 1.5px;
            margin: 0;
          }
          .subtitle {
            color: #9E9EA4;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
            letter-spacing: 1px;
          }
          .plan-box {
            background-color: #161619;
            border: 1px solid #27272A;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
          }
          .plan-title {
            font-size: 16px;
            font-weight: 800;
            color: #F5F5F5;
          }
          .plan-period {
            font-size: 12px;
            color: #9E9EA4;
            margin-top: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background-color: #161619;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #27272A;
          }
          th {
            background-color: #1A1A1E;
            color: #9E9EA4;
            font-size: 10px;
            font-weight: 800;
            padding: 10px 8px;
            text-align: left;
            letter-spacing: 0.5px;
          }
          .footer {
            margin-top: 24px;
            text-align: right;
            font-size: 10px;
            color: #71717A;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">SARAIVA TEAM</h1>
          <div class="subtitle">PROGRESSIVE OVERLOAD • RELATÓRIO OFICIAL DE CARGAS</div>
        </div>

        <div class="plan-box">
          <div>
            <div class="plan-title">${name}</div>
            <div class="plan-period">Período Oficial: ${formatBrDate(startDate)} até ${formatBrDate(endDate)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #C62828; font-weight: bold;">TOTAL LOGS: ${validLogs.length}</div>
            <div style="font-size: 10px; color: #9E9EA4; margin-top: 2px;">Agrupamento: ${
              groupingMode === 'by_division' ? 'Por Divisão do Protocolo' :
              groupingMode === 'by_exercise' ? 'Por Exercício (Semanas)' : 'Cronológico'
            }</div>
          </div>
        </div>

        ${tablesHtml}

        <div class="footer">
          Gerado pelo aplicativo mobile Log de Treino • Metodologia Saraiva Team
        </div>
      </body>
    </html>
  `;

  await Print.printAsync({ html: htmlContent });
}
