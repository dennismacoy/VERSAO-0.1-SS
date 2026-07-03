import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const COMPANY_NAME = 'Atacadao';
const COMPANY_SUB = 'Filial - 685 Franca';

// Shared professional header — NEUTRAL tones (gray/white, no black bars)
const drawHeader = (doc, title, subtitle) => {
  const w = doc.internal.pageSize.getWidth();

  // Light gray header bar
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, w, 34, 'F');

  // Bottom accent line (subtle green)
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 34, w, 1.5, 'F');

  // Company name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(COMPANY_NAME, 14, 14);

  // Company sub
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text(COMPANY_SUB, 14, 21);

  // Title (right)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 120, 60);
  doc.text(title, w - 14, 14, { align: 'right' });

  // Subtitle (right)
  if (subtitle) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(subtitle, w - 14, 22, { align: 'right' });
  }
};

// Shared professional footer
const drawFooter = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;

  doc.setFillColor(248, 248, 248);
  doc.rect(0, h - 14, w, 14, 'F');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text(`Gerado em ${dateStr} — ${COMPANY_NAME}`, 14, h - 5);
  doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, w - 14, h - 5, { align: 'right' });
};

// Neutral table styles (gray headers, no black)
const baseTableStyles = {
  theme: 'grid',
  styles: {
    font: 'helvetica',
    fontSize: 8,
    cellPadding: 3,
    lineColor: [210, 210, 215],
    lineWidth: 0.3,
    valign: 'middle',
  },
  headStyles: {
    fillColor: [230, 230, 235],
    textColor: [50, 50, 50],
    fontStyle: 'bold',
    fontSize: 8,
  },
  alternateRowStyles: {
    fillColor: [250, 250, 252],
  },
  margin: { bottom: 18 },
};

// =============================================
// PRÉ-VENDA PDF (also used for Pedido Convertido)
// =============================================
export const generatePreVendaPDF = (item) => {
  if (!item || !item.itens || item.itens.length === 0) return;

  try {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const dataObj = new Date(item.data || item.createdAt);

    drawHeader(doc, 'PRÉ-VENDA', `#${item.firebaseId?.slice(-6) || item.id} | ${dataObj.toLocaleDateString('pt-BR')}`);

    // Info section
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(14, 42, w - 28, 16, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text('Cliente:', 20, 51);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(item.cliente || 'NÃO INFORMADO', 42, 51);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${formatCurrency(item.total)}`, w - 20, 53, { align: 'right' });

    const tableData = item.itens.map(prod => [
      { content: '', styles: { minCellHeight: 18 } },
      prod.codigo,
      prod.descricao,
      prod.embalagem || prod.emb || 'UN',
      prod.qtd?.toString() || '0',
      formatCurrency(prod.preco || prod.preco_unitario || 0),
      formatCurrency(prod.subtotal || (prod.qtd * (prod.preco || 0)))
    ]);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 65,
      head: [['Barras', 'Código', 'Descrição', 'Emb', 'Qtd', 'Preço', 'Subtotal']],
      body: tableData,
      columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 'auto' } },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const prod = item.itens[data.row.index];
          if (!prod) return;
          const canvas = document.createElement('canvas');
          try {
            const barcodeValue = `${prod.codigo || ''}${prod.codigo_interno || ''}`;
            JsBarcode(canvas, barcodeValue, { format: 'CODE128', displayValue: false, height: 30, width: 1.5, margin: 0 });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', data.cell.x + 1, data.cell.y + 2, 28, 12);
          } catch (e) { /* skip invalid barcodes */ }
        }
      }
    });

    drawFooter(doc);
    doc.save(`prevenda_${item.firebaseId?.slice(-6) || item.id}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Pré-Venda:', error);
    alert('Ocorreu um erro ao gerar o PDF.');
  }
};

// =============================================
// PICKING / SEPARAÇÃO PDF
// =============================================
export const generatePickingPDF = (item) => {
  try {
    const doc = new jsPDF();

    drawHeader(doc, 'LISTA DE SEPARAÇÃO', `#${item.id || item.firebaseId?.slice(-6)} | ${new Date(item.data || item.createdAt).toLocaleDateString('pt-BR')}`);

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Responsável: ${item.atribuicao || item.separador || '-'}`, 14, 46);

    const tableData = (item.itens || []).map(prod => [
      prod.codigo,
      prod.descricao,
      prod.embalagem || prod.emb || '',
      prod.estoque || '0',
      prod.qtd?.toString() || '0'
    ]);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 52,
      head: [['Código', 'Descrição', 'Emb', 'Estoque', 'Qtd Pedida']],
      body: tableData,
      styles: { ...baseTableStyles.styles, fontSize: 11, cellPadding: 4 },
    });

    drawFooter(doc);
    doc.save(`picking_${item.id || item.firebaseId?.slice(-6)}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Picking:', error);
    alert('Ocorreu um erro ao gerar o PDF.');
  }
};

// =============================================
// RELATÓRIO PDF — Colunas: Código, Descrição, Embalagem, Entrada, Dias S/Venda, Estoque
// =============================================
export const generateRelatorioPDF = (batchInput, totalInRisk, selectedRazao) => {
  if (!batchInput) {
    console.warn("Nenhum dado fornecido para o relatório PDF.");
    return;
  }

  try {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();

    let batch = [];
    if (Array.isArray(batchInput)) {
      if (batchInput.length === 0) {
        console.warn("Array de dados para o relatório PDF está vazio.");
        return;
      }
      
      // Se for um array de objetos (lote)
      if (typeof batchInput[0] === 'object' && batchInput[0] !== null) {
        batch = batchInput.map(item => {
          const dados = item.dados || item.filteredData || item.data;
          return {
            filteredData: Array.isArray(dados) ? dados : [],
            totalInRisk: item.totalInRisk !== undefined ? item.totalInRisk : 0,
            selectedRazao: item.cliente || item.selectedRazao || item.razao || ''
          };
        });
      } else {
        // Se for um array de produtos directamente (lote único simplificado)
        batch = [{
          filteredData: batchInput,
          totalInRisk: totalInRisk || 0,
          selectedRazao: selectedRazao || ''
        }];
      }
    } else if (typeof batchInput === 'object' && batchInput !== null) {
      // Se for um único objeto contendo os dados
      const dados = batchInput.dados || batchInput.filteredData || batchInput.data;
      batch = [{
        filteredData: Array.isArray(dados) ? dados : [],
        totalInRisk: batchInput.totalInRisk !== undefined ? batchInput.totalInRisk : (totalInRisk || 0),
        selectedRazao: batchInput.cliente || batchInput.selectedRazao || batchInput.razao || (selectedRazao || '')
      }];
    } else {
      console.warn("Formato inválido de batchInput fornecido para o relatório PDF.");
      return;
    }

    // Filtrar lotes que não têm dados ou onde o array está vazio para evitar quebras silenciosas da biblioteca
    const validBatches = batch.filter(report => {
      const dados = report.filteredData;
      return dados && Array.isArray(dados) && dados.length > 0;
    });

    if (validBatches.length === 0) {
      console.warn("Nenhum lote válido com dados de produtos foi encontrado para gerar o PDF.");
      return;
    }

    validBatches.forEach((report, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const currentRazao = report.selectedRazao || 'Relatório Geral';
      const currentFilteredData = report.filteredData;
      const currentTotalInRisk = report.totalInRisk || 0;

      drawHeader(doc, 'AUDITORIA DE ESTOQUE', currentRazao);

      // Summary bar
      doc.setFillColor(255, 240, 240);
      doc.roundedRect(14, 42, w - 28, 12, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 30, 30);
      doc.text(`TOTAL EM RISCO (IDW): ${formatCurrency(currentTotalInRisk)}`, 20, 50);

      autoTable(doc, {
        ...baseTableStyles,
        startY: 60,
        head: [['Código', 'Descrição', 'Embalagem', 'Entrada', 'Dias S/ Venda', 'Estoque']],
        body: currentFilteredData.map(item => [
          item?.CODIGO || item?.codigo || '',
          item?.DESCRICAO || item?.descricao || '',
          item?.EMBALAGEM || item?.embalagem || item?.emb || 'UN',
          item?.ENTRADA || item?.entrada || '-',
          String(item?.DIAS_SEM_VENDA || item?.ISV || item?.dias_sem_venda || '0'),
          String(item?.ESTOQUE || item?.QTE || item?.estoque || '0'),
        ]),
      });

      drawFooter(doc);
    });

    doc.save(`relatorio_auditoria_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Relatório:', error);
    alert('Ocorreu um erro ao gerar o PDF de Relatório. Verifique o console para mais detalhes.');
  }
};

// =============================================
// PEDIDO B2B PDF — Usa mesmo layout de Pré-Venda
// =============================================
export const generateB2BPDF = (pedido) => {
  // Redireciona para o layout de Pré-Venda
  return generatePreVendaPDF(pedido);
};

// =============================================
// SEPARAÇÃO PDF — Enxuto: Código, Descrição, Embalagem, Quantidade
// =============================================
export const generateSeparacaoPDF = (pedido) => {
  if (!pedido || !pedido.itens || pedido.itens.length === 0) return;

  try {
    const doc = new jsPDF();
    const dataObj = new Date(pedido.data || pedido.createdAt);

    drawHeader(doc, 'GUIA DE SEPARAÇÃO', `#${pedido.firebaseId?.slice(-6) || pedido.id} | ${dataObj.toLocaleDateString('pt-BR')}`);

    const w = doc.internal.pageSize.getWidth();

    // Info section
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(14, 42, w - 28, 20, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text('Cliente:', 20, 51);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(pedido.cliente || 'NÃO INFORMADO', 42, 51);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Separador: ${pedido.atribuido || pedido.separador || 'Não atribuído'}`, 20, 57);
    doc.text(`Total de itens: ${pedido.itens.length}`, w - 20, 57, { align: 'right' });

    const tableData = pedido.itens.map(prod => [
      prod.codigo || '',
      prod.descricao || '',
      prod.embalagem || prod.emb || 'UN',
      prod.qtd?.toString() || '0',
    ]);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 68,
      head: [['Código', 'Descrição', 'Embalagem', 'Qtd']],
      body: tableData,
      styles: { ...baseTableStyles.styles, fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      },
    });

    drawFooter(doc);
    doc.save(`separacao_${pedido.firebaseId?.slice(-6) || pedido.id}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Separação:', error);
    alert('Ocorreu um erro ao gerar o PDF de separação.');
  }
};
