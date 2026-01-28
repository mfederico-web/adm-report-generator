'use client';

import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const MESI = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
const TIPI_GIOCO = ["IP", "QF", "BIG", "CPS", "V7", "IN", "Tutti"];

const SHEET_TO_TIPO = {
  'Prestazioni QF': 'QF', 'Prestazioni BIG': 'BIG', 'Prestazioni CPS': 'CPS',
  'Prestazioni PSCP': 'CPS', 'Prestazioni IPPICA': 'IP', 'Prestazioni IP': 'IP',
  'Prestazioni PGDA': 'IN', 'Prestazioni IN': 'IN', 'Prestazioni PSV': 'V7',
  'Prestazioni V7': 'V7', 'IP': 'IP', 'QF': 'QF', 'BIG': 'BIG', 'CPS': 'CPS', 'V7': 'V7', 'IN': 'IN'
};

export default function ADMReportGenerator() {
  const [frontespizio, setFrontespizio] = useState({
    anno: '2025',
    dataConsegna: '28/01/2026',
    concessionario: 'Scommettendo srl',
    codiceConcessione: '15125',
    tipologia: 'IPPICA E SPORT',
    titolareSistema: 'Exalogic SRL',
    localizzazioneCED: 'ROZZANO',
    fornitoreServizio: 'SCOMMETTENDO SRL FSC 88'
  });

  const [files, setFiles] = useState({
    prestazioni: null,
    disponibilita: null,
    ripristino: null
  });

  const [parsedData, setParsedData] = useState({
    prestazioni: null,
    disponibilita: null,
    ripristino: null
  });

  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const parsePrestazioni = (workbook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    const mesiData = {};
    for (let m = 1; m <= 12; m++) mesiData[m] = [];
    
    data.forEach(row => {
      const mese = row['Mese'];
      if (mese >= 1 && mese <= 12) {
        mesiData[mese].push({
          settimana: row['Settimana'],
          giocate: row['Giocate'] || 0,
          giocate5sec: row['Giocate emesse in più di 5 secondi'] || 0,
          percentuale: row['%'] || 0
        });
      }
    });
    return mesiData;
  };

  const parseDisponibilita = (workbook) => {
    const result = {};
    workbook.SheetNames.forEach(sheetName => {
      const tipoGioco = SHEET_TO_TIPO[sheetName];
      if (!tipoGioco) return;
      
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const mesiData = {};
      
      for (let meseIdx = 0; meseIdx < 12; meseIdx++) {
        const colGiorno = 1 + (meseIdx * 4);
        const colDisp = 2 + (meseIdx * 4);
        mesiData[MESI[meseIdx]] = [];
        
        for (let rowIdx = 1; rowIdx < Math.min(rawData.length, 35); rowIdx++) {
          const row = rawData[rowIdx];
          if (row && row[colGiorno] !== undefined && row[colDisp] !== undefined) {
            let disp = row[colDisp];
            if (typeof disp === 'string') disp = parseFloat(disp.replace(',', '.'));
            if (!isNaN(disp) && disp > 0) {
              mesiData[MESI[meseIdx]].push({ giorno: parseInt(row[colGiorno]), disponibilita: disp });
            }
          }
        }
      }
      result[tipoGioco] = mesiData;
    });
    return result;
  };

  const parseRipristino = (workbook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const mesiData = {};
    for (let m = 1; m <= 12; m++) mesiData[m] = {};
    
    data.slice(1).forEach(row => {
      if (row[0] && row[1] !== undefined) {
        let date;
        if (typeof row[0] === 'number') {
          date = new Date((row[0] - 25569) * 86400 * 1000);
        } else {
          date = new Date(row[0]);
        }
        
        if (date && !isNaN(date.getTime())) {
          const mese = date.getMonth() + 1;
          const giorno = date.getDate();
          const secondi = parseInt(row[1]) || 0;
          
          if (!mesiData[mese][giorno]) {
            mesiData[mese][giorno] = { chiamate: 0, tempo: 0 };
          }
          mesiData[mese][giorno].chiamate++;
          mesiData[mese][giorno].tempo += secondi;
        }
      }
    });
    return mesiData;
  };

  const handleFileUpload = useCallback((type, file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let parsed;
        if (type === 'prestazioni') parsed = parsePrestazioni(workbook);
        else if (type === 'disponibilita') parsed = parseDisponibilita(workbook);
        else if (type === 'ripristino') parsed = parseRipristino(workbook);
        
        setFiles(prev => ({ ...prev, [type]: file }));
        setParsedData(prev => ({ ...prev, [type]: parsed }));
        setStatus(`✅ ${file.name} caricato con successo`);
      } catch (err) {
        setStatus(`❌ Errore parsing: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const formatNumber = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '0';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const generatePDF = useCallback(() => {
    if (!parsedData.prestazioni || !parsedData.disponibilita) {
      setStatus('❌ Carica Prestazioni e Disponibilità Sistema prima di generare');
      return;
    }

    setGenerating(true);
    setStatus('⏳ Generazione PDF in corso...');

    setTimeout(() => {
      try {
        // ========================================
        // PAGINA 1: FRONTESPIZIO (PORTRAIT)
        // ========================================
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const margin = 15;
        let y = margin;

        // Titolo principale
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Rilevazioni sul Gioco Fisico ai fini del controllo dei Livelli', margin, y);
        y += 12;

        // === TABELLA DATI FRONTESPIZIO ===
        const tableWidth = 170;
        const col1Width = 55;
        const col2Width = 115;
        const rowHeight = 8;

        const infoFields = [
          ['Anno sottoposto a verifica:', `Anno: ${frontespizio.anno}`],
          ['Consegnato ad ADM:', frontespizio.dataConsegna],
          ['Concessionario:', frontespizio.concessionario],
          ['Codice Concessione:', frontespizio.codiceConcessione],
          ['Tipologia (Ippica/Sport):', frontespizio.tipologia],
          ['Titolare di Sistema:', frontespizio.titolareSistema],
          ['Localizzazione CED:', frontespizio.localizzazioneCED]
        ];

        doc.setFontSize(10);
        infoFields.forEach(([label, value]) => {
          // Cella label (sfondo grigio chiaro)
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, y, col1Width, rowHeight, 'F');
          doc.rect(margin, y, col1Width, rowHeight);
          doc.setFont('helvetica', 'bold');
          doc.text(label, margin + 2, y + 5.5);
          
          // Cella valore
          doc.rect(margin + col1Width, y, col2Width, rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.text(value, margin + col1Width + 3, y + 5.5);
          
          y += rowHeight;
        });

        y += 12;

        // === TABELLA GIOCHI PUBBLICI ===
        const giochiColWidth = 110;
        const fornitoreColWidth = 60;
        
        // Header tabella
        doc.setFillColor(230, 230, 230);
        doc.rect(margin, y, giochiColWidth, rowHeight, 'F');
        doc.rect(margin, y, giochiColWidth, rowHeight);
        doc.rect(margin + giochiColWidth, y, fornitoreColWidth, rowHeight, 'F');
        doc.rect(margin + giochiColWidth, y, fornitoreColWidth, rowHeight);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Giochi Pubblici', margin + 2, y + 5.5);
        doc.text('Fornitore del Servizio', margin + giochiColWidth + 2, y + 5.5);
        y += rowHeight;
        
        // Righe giochi
        doc.setFont('helvetica', 'normal');
        const giochi = [
          'Scommesse ippiche a totalizzatore e a Quota Fissa (IP)',
          'Scommesse sportive a quota fissa (QF)',
          'Scommesse a totalizzatore (BIG)',
          'Concorsi Pronostici Sportivi (CPS)',
          'V7',
          'Ippica Nazionale (IN)'
        ];
        
        giochi.forEach(g => {
          doc.rect(margin, y, giochiColWidth, rowHeight);
          doc.rect(margin + giochiColWidth, y, fornitoreColWidth, rowHeight);
          doc.setFontSize(9);
          doc.text(g, margin + 2, y + 5.5);
          doc.text(frontespizio.fornitoreServizio, margin + giochiColWidth + 2, y + 5.5);
          y += rowHeight;
        });

        // ========================================
        // PAGINE 2-5: PRESTAZIONI (PORTRAIT)
        // ========================================
        const prestazioniPages = [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12]];
        
        prestazioniPages.forEach((mesiPage, pageIndex) => {
          doc.addPage('a4', 'p'); // 'p' = portrait
          y = margin;
          
          if (pageIndex === 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('1. Prestazioni del Sistema', margin, y);
            y += 6;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('(la durata dell\'operazione di vendita si considera al netto del tempo di elaborazione del Totalizzatore Nazionale)', margin, y);
            y += 5;
            doc.text('Durata operazione di vendita = tempo intercorrente tra la conferma della giocata e la stampa completa', margin, y);
            y += 4;
            doc.text('della ricevuta di partecipazione.', margin, y);
            y += 5;
            doc.text('Giocate = numero di transazioni', margin, y);
            y += 4;
            doc.text('Intervallo di rilevazione = un rigo per ogni settimana', margin, y);
            y += 8;
          }

          mesiPage.forEach(meseNum => {
            const meseData = parsedData.prestazioni[meseNum] || [];
            if (!meseData.length) return;

            doc.setFillColor(230, 230, 230);
            doc.rect(margin, y, 165, 6, 'F');
            doc.rect(margin, y, 165, 6);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Mese: ${MESI[meseNum - 1]}`, margin + 2, y + 4);
            doc.text('Giocate', margin + 55, y + 4);
            doc.text('Giocate emesse in più di 5 sec', margin + 90, y + 4);
            doc.text('%', margin + 155, y + 4);
            y += 6;
            
            doc.setFont('helvetica', 'normal');
            doc.rect(margin, y, 165, 5);
            y += 5;

            let totG = 0, tot5 = 0, sumP = 0, countP = 0;
            
            meseData.forEach(r => {
              doc.rect(margin, y, 40, 5);
              doc.rect(margin + 40, y, 45, 5);
              doc.rect(margin + 85, y, 55, 5);
              doc.rect(margin + 140, y, 25, 5);
              
              doc.text(String(r.settimana || ''), margin + 18, y + 3.5);
              doc.text(formatNumber(r.giocate), margin + 60, y + 3.5);
              doc.text(formatNumber(r.giocate5sec), margin + 110, y + 3.5);
              const perc = r.percentuale || 0;
              doc.text(perc.toFixed(2).replace('.', ','), margin + 148, y + 3.5);
              
              totG += (r.giocate || 0);
              tot5 += (r.giocate5sec || 0);
              sumP += perc;
              countP++;
              y += 5;
            });

            doc.setFillColor(255, 255, 200);
            doc.rect(margin, y, 40, 5, 'F');
            doc.rect(margin + 40, y, 45, 5, 'F');
            doc.rect(margin + 85, y, 55, 5, 'F');
            doc.rect(margin + 140, y, 25, 5, 'F');
            doc.rect(margin, y, 40, 5);
            doc.rect(margin + 40, y, 45, 5);
            doc.rect(margin + 85, y, 55, 5);
            doc.rect(margin + 140, y, 25, 5);
            
            doc.setFont('helvetica', 'bold');
            doc.text('Totale', margin + 15, y + 3.5);
            doc.text(formatNumber(totG), margin + 60, y + 3.5);
            doc.text(formatNumber(tot5), margin + 110, y + 3.5);
            const avgP = countP > 0 ? sumP / countP : 0;
            doc.text(avgP.toFixed(2).replace('.', ','), margin + 148, y + 3.5);
            y += 10;

            if (y > 260) { doc.addPage('a4', 'p'); y = margin; }
          });
        });

        // ========================================
        // DISPONIBILITÀ SISTEMA (LANDSCAPE)
        // ========================================
        const trimestri = [
          ['GENNAIO', 'FEBBRAIO', 'MARZO'],
          ['APRILE', 'MAGGIO', 'GIUGNO'],
          ['LUGLIO', 'AGOSTO', 'SETTEMBRE'],
          ['OTTOBRE', 'NOVEMBRE', 'DICEMBRE']
        ];

        Object.keys(parsedData.disponibilita).forEach(tipoGioco => {
          const tipoData = parsedData.disponibilita[tipoGioco];

          trimestri.forEach((mesiTrimestre) => {
            // LANDSCAPE: 'l' = landscape
            doc.addPage('a4', 'l');
            y = 10;

            // Pagina landscape: larghezza 297mm, altezza 210mm
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('2. Disponibilità del sistema di elaborazione e della rete telematica', 10, y);
            y += 5;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Per ogni giorno si considera Fascia Oraria l\'intervallo di tempo del funzionamento del Totalizzatore Nazionale ovvero dalle ore 07:00 alle ore 23:00', 10, y);
            y += 6;

            // TipoGioco checkboxes - X solo sul tipo gioco corrente
            doc.setFontSize(8);
            doc.text('TipoGioco:', 10, y);
            let xCheck = 35;
            TIPI_GIOCO.forEach(tipo => {
              // Disegna box
              doc.rect(xCheck, y - 3, 4, 4);
              doc.text(tipo, xCheck + 6, y);
              // Metti X SOLO per il tipo gioco corrente della pagina
              if (tipo === tipoGioco) {
                doc.setFont('helvetica', 'bold');
                doc.text('X', xCheck + 0.8, y - 0.2);
                doc.setFont('helvetica', 'normal');
              }
              xCheck += 25;
            });
            y += 8;

            // Larghezza disponibile in landscape: ~277mm (297 - 20 margini)
            const colWidth = 90;
            const startX = 10;

            // Headers dei mesi
            mesiTrimestre.forEach((nomeMese, idx) => {
              const xBase = startX + (idx * colWidth);
              
              doc.setFillColor(255, 255, 200);
              doc.rect(xBase, y, colWidth - 5, 6, 'F');
              doc.rect(xBase, y, colWidth - 5, 6);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
              doc.text(`mese:`, xBase + 2, y + 4);
              doc.text(nomeMese, xBase + 15, y + 4);
            });
            y += 6;

            // Subheaders (giorno | disponibilità%)
            mesiTrimestre.forEach((_, idx) => {
              const xBase = startX + (idx * colWidth);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.rect(xBase, y, 25, 5);
              doc.rect(xBase + 25, y, colWidth - 30, 5);
              doc.text('giorno', xBase + 8, y + 3.5);
              doc.text('disponibilità%', xBase + 45, y + 3.5);
            });
            y += 5;

            // Righe dati (31 giorni)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            
            for (let giorno = 1; giorno <= 31; giorno++) {
              mesiTrimestre.forEach((nomeMese, idx) => {
                const xBase = startX + (idx * colWidth);
                const meseData = tipoData[nomeMese] || [];
                const dayData = meseData.find(d => d.giorno === giorno);
                
                doc.rect(xBase, y, 25, 4);
                doc.rect(xBase + 25, y, colWidth - 30, 4);
                
                doc.text(String(giorno), xBase + 10, y + 2.8);
                if (dayData) {
                  doc.text(dayData.disponibilita.toFixed(2).replace('.', ','), xBase + 50, y + 2.8);
                }
              });
              y += 4;
            }

            // Riga Totale - FIX: disegna correttamente per ogni mese
            mesiTrimestre.forEach((nomeMese, idx) => {
              const xBase = startX + (idx * colWidth);
              const meseData = tipoData[nomeMese] || [];
              const media = meseData.length > 0 
                ? meseData.reduce((sum, d) => sum + d.disponibilita, 0) / meseData.length 
                : 0;
              
              // Sfondo giallo
              doc.setFillColor(255, 255, 200);
              doc.rect(xBase, y, 25, 5, 'FD');
              doc.rect(xBase + 25, y, colWidth - 30, 5, 'FD');
              
              // Testo
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.text('Totale', xBase + 5, y + 3.5);
              if (meseData.length > 0) {
                doc.text(media.toFixed(2).replace('.', ','), xBase + 50, y + 3.5);
              }
            });
            doc.setFont('helvetica', 'normal');
          });
        });

        // ========================================
        // RIPRISTINO SISTEMA (LANDSCAPE)
        // ========================================
        if (parsedData.ripristino) {
          trimestri.forEach((mesiTrimestre) => {
            // LANDSCAPE
            doc.addPage('a4', 'l');
            y = 10;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Ripristino del Sistema in caso di malfunzionamento', 10, y);
            y += 5;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Tempo = tempo di risoluzione espresso in ore', 10, y);
            y += 6;

            // TipoGioco checkboxes - solo "Tutti" selezionato
            doc.setFontSize(7);
            doc.text('TipoGioco:', 10, y);
            let xCheck = 30;
            TIPI_GIOCO.forEach(tipo => {
              // Disegna box
              doc.rect(xCheck, y - 3, 4, 4);
              doc.text(tipo, xCheck + 6, y);
              // Solo "Tutti" ha la X
              if (tipo === 'Tutti') {
                doc.setFont('helvetica', 'bold');
                doc.text('X', xCheck + 0.8, y - 0.2);
                doc.setFont('helvetica', 'normal');
              }
              xCheck += 18;
            });
            y += 8;

            // Due sezioni: Con limitazione | Senza limitazione
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('Con limitazione del gioco', 50, y);
            doc.text('Senza limitazione del gioco', 185, y);
            y += 5;

            const colW = 42;
            
            // Headers mesi - Sezione SX
            mesiTrimestre.forEach((nomeMese, idx) => {
              const xBase = 10 + (idx * colW);
              doc.setFillColor(255, 255, 200);
              doc.rect(xBase, y, colW - 2, 5, 'F');
              doc.rect(xBase, y, colW - 2, 5);
              doc.setFontSize(7);
              doc.text(`mese:`, xBase + 2, y + 3.5);
              doc.text(nomeMese, xBase + 12, y + 3.5);
            });
            
            // Headers mesi - Sezione DX
            mesiTrimestre.forEach((nomeMese, idx) => {
              const xBase = 145 + (idx * colW);
              doc.setFillColor(255, 255, 200);
              doc.rect(xBase, y, colW - 2, 5, 'F');
              doc.rect(xBase, y, colW - 2, 5);
              doc.text(`mese: ${nomeMese}`, xBase + 2, y + 3.5);
            });
            y += 5;

            // Subheaders (giorno | chiamate | tempo)
            doc.setFontSize(6);
            
            // Sezione SX
            mesiTrimestre.forEach((_, idx) => {
              const xBase = 10 + (idx * colW);
              doc.rect(xBase, y, 10, 4);
              doc.rect(xBase + 10, y, 15, 4);
              doc.rect(xBase + 25, y, 15, 4);
              doc.text('giorno', xBase + 1, y + 2.8);
              doc.text('chiamate', xBase + 11, y + 2.8);
              doc.text('tempo', xBase + 26, y + 2.8);
            });
            
            // Sezione DX
            mesiTrimestre.forEach((_, idx) => {
              const xBase = 145 + (idx * colW);
              doc.rect(xBase, y, 10, 4);
              doc.rect(xBase + 10, y, 15, 4);
              doc.rect(xBase + 25, y, 15, 4);
              doc.text('giorno', xBase + 1, y + 2.8);
              doc.text('chiamate', xBase + 11, y + 2.8);
              doc.text('tempo', xBase + 26, y + 2.8);
            });
            y += 4;

            // Righe dati (31 giorni)
            doc.setFont('helvetica', 'normal');
            
            for (let giorno = 1; giorno <= 31; giorno++) {
              // Sezione SX - Con limitazione (dati reali)
              mesiTrimestre.forEach((nomeMese, idx) => {
                const xBase = 10 + (idx * colW);
                const meseNum = MESI.indexOf(nomeMese) + 1;
                const dayData = parsedData.ripristino[meseNum]?.[giorno];
                
                doc.rect(xBase, y, 10, 3.5);
                doc.rect(xBase + 10, y, 15, 3.5);
                doc.rect(xBase + 25, y, 15, 3.5);
                
                doc.text(String(giorno), xBase + 3, y + 2.5);
                if (dayData && dayData.chiamate > 0) {
                  doc.text(String(dayData.chiamate), xBase + 14, y + 2.5);
                  doc.text(`${dayData.tempo} sec`, xBase + 26, y + 2.5);
                }
              });
              
              // Sezione DX - Senza limitazione (vuota)
              mesiTrimestre.forEach((_, idx) => {
                const xBase = 145 + (idx * colW);
                doc.rect(xBase, y, 10, 3.5);
                doc.rect(xBase + 10, y, 15, 3.5);
                doc.rect(xBase + 25, y, 15, 3.5);
                doc.text(String(giorno), xBase + 3, y + 2.5);
              });
              
              y += 3.5;
            }
          });
        }

        // ========================================
        // CALL CENTER (LANDSCAPE)
        // ========================================
        doc.addPage('a4', 'l');
        y = 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Disponibilità Call Center (opzionale)', 10, y);
        y += 5;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Indicare il tempo o il numero di casi fuori percentuale', 10, y);
        y += 8;

        const ccColW = 90;
        ['mese:', 'mese:', 'mese:'].forEach((_, idx) => {
          const xBase = 10 + (idx * ccColW);
          doc.setFillColor(255, 255, 200);
          doc.rect(xBase, y, ccColW - 5, 5, 'F');
          doc.rect(xBase, y, ccColW - 5, 5);
          doc.text('mese:', xBase + 2, y + 3.5);
        });
        y += 5;

        doc.setFontSize(6);
        [0, 1, 2].forEach((idx) => {
          const xBase = 10 + (idx * ccColW);
          doc.rect(xBase, y, 15, 4);
          doc.rect(xBase + 15, y, 25, 4);
          doc.rect(xBase + 40, y, 20, 4);
          doc.rect(xBase + 60, y, 25, 4);
          doc.text('giorno', xBase + 2, y + 2.8);
          doc.text('informativa', xBase + 17, y + 2.8);
          doc.text('tempo', xBase + 42, y + 2.8);
          doc.text('correttiva', xBase + 62, y + 2.8);
        });
        y += 4;

        for (let giorno = 1; giorno <= 31; giorno++) {
          [0, 1, 2].forEach((idx) => {
            const xBase = 10 + (idx * ccColW);
            doc.rect(xBase, y, 15, 3.5);
            doc.rect(xBase + 15, y, 25, 3.5);
            doc.rect(xBase + 40, y, 20, 3.5);
            doc.rect(xBase + 60, y, 25, 3.5);
            doc.text(String(giorno), xBase + 5, y + 2.5);
          });
          y += 3.5;
        }

        // Salva PDF
        doc.save(`Report_ADM_${frontespizio.codiceConcessione}_${frontespizio.anno}.pdf`);
        setStatus('✅ PDF generato e scaricato con successo!');
        
      } catch (err) {
        console.error(err);
        setStatus(`❌ Errore generazione: ${err.message}`);
      } finally {
        setGenerating(false);
      }
    }, 100);
  }, [frontespizio, parsedData]);

  const canGenerate = parsedData.prestazioni && parsedData.disponibilita;

  const handleReset = useCallback(() => {
    setFiles({
      prestazioni: null,
      disponibilita: null,
      ripristino: null
    });
    setParsedData({
      prestazioni: null,
      disponibilita: null,
      ripristino: null
    });
    setFrontespizio({
      anno: '2025',
      dataConsegna: '28/01/2026',
      concessionario: 'Scommettendo srl',
      codiceConcessione: '15125',
      tipologia: 'IPPICA E SPORT',
      titolareSistema: 'Exalogic SRL',
      localizzazioneCED: 'ROZZANO',
      fornitoreServizio: 'SCOMMETTENDO SRL FSC 88'
    });
    setStatus('🔄 Tutti i dati sono stati resettati');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">
            🎰 Generatore Report ADM
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            Rilevazioni sul Gioco Fisico - Controllo Livelli di Servizio
          </p>
        </div>

        <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-5 md:p-6 mb-4 border border-gray-700">
          <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-3">
            <span className="bg-yellow-400 text-black w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Dati Frontespizio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['anno', 'Anno verifica'],
              ['dataConsegna', 'Data consegna ADM'],
              ['concessionario', 'Concessionario'],
              ['codiceConcessione', 'Codice Concessione'],
              ['tipologia', 'Tipologia'],
              ['titolareSistema', 'Titolare Sistema'],
              ['localizzazioneCED', 'Localizzazione CED'],
              ['fornitoreServizio', 'Fornitore Servizio']
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                <input
                  value={frontespizio[key]}
                  onChange={(e) => setFrontespizio(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/50 transition"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-5 md:p-6 mb-4 border border-gray-700">
          <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-3">
            <span className="bg-yellow-400 text-black w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            Upload File Excel
          </h2>
          <div className="space-y-3">
            {[
              { type: 'prestazioni', icon: '📊', label: 'Prestazioni Sistema', required: true, desc: 'Colonne: Mese, Settimana, Giocate, >5sec, %' },
              { type: 'disponibilita', icon: '📈', label: 'Disponibilità Sistema', required: true, desc: 'Fogli per tipo gioco (QF, BIG, IP...)' },
              { type: 'ripristino', icon: '🔧', label: 'Ripristino Sistema', required: false, desc: 'Colonne: Data, Secondi (opzionale)' }
            ].map(({ type, icon, label, required, desc }) => (
              <div 
                key={type} 
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  files[type] 
                    ? 'bg-green-900/20 border-green-600/50' 
                    : 'bg-gray-700/30 border-gray-600/50 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl">{icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">
                    {label} {required && <span className="text-red-400 text-xs">*obbligatorio</span>}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{desc}</p>
                  {files[type] && (
                    <p className="text-xs text-green-400 mt-1">✓ {files[type].name}</p>
                  )}
                </div>
                <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                  files[type]
                    ? 'bg-green-600 text-white hover:bg-green-500'
                    : 'bg-yellow-400 text-black hover:bg-yellow-300 hover:scale-105'
                }`}>
                  {files[type] ? '✓ Caricato' : 'Scegli file'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileUpload(type, e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-5 md:p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-3">
            <span className="bg-yellow-400 text-black w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            Genera Report PDF
          </h2>

          {status && (
            <div className={`p-4 rounded-xl mb-4 text-sm ${
              status.includes('✅') ? 'bg-green-900/30 text-green-300 border border-green-700' :
              status.includes('❌') ? 'bg-red-900/30 text-red-300 border border-red-700' :
              'bg-blue-900/30 text-blue-300 border border-blue-700'
            }`}>
              {status}
            </div>
          )}

          <button
            onClick={generatePDF}
            disabled={generating || !canGenerate}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform ${
              generating || !canGenerate
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-300 hover:to-yellow-400 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-400/20'
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generazione in corso...
              </span>
            ) : canGenerate ? (
              '📄 GENERA PDF REPORT ADM'
            ) : (
              '⚠️ Carica i file obbligatori'
            )}
          </button>

          {/* Bottone Reset */}
          <button
            onClick={handleReset}
            className="w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all transform bg-gray-700 text-gray-300 hover:bg-red-600 hover:text-white hover:scale-[1.01] active:scale-[0.99] border border-gray-600 hover:border-red-500"
          >
            🔄 RESET - Pulisci Tutti i Dati
          </button>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {files.prestazioni && (
              <span className="inline-flex items-center gap-1 bg-gray-700 px-3 py-1 rounded-full text-xs">
                ✓ Prestazioni
              </span>
            )}
            {files.disponibilita && (
              <span className="inline-flex items-center gap-1 bg-gray-700 px-3 py-1 rounded-full text-xs">
                ✓ Disponibilità
              </span>
            )}
            {files.ripristino && (
              <span className="inline-flex items-center gap-1 bg-gray-700 px-3 py-1 rounded-full text-xs">
                ✓ Ripristino
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-xs">
          <p>Report ADM Generator v1.7</p>
          <p className="mt-1">Rilevazioni sul Gioco Fisico ai fini del controllo dei Livelli di Servizio</p>
        </div>
      </div>
    </div>
  );
}
