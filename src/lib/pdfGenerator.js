import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const COMPANY_NAME = 'SmartStock ERP';
const COMPANY_SUB = 'Gestão Logística & Comercial';

// Shared professional header
const drawHeader = (doc, title, subtitle) => {
  const w = doc.internal.pageSize.getWidth();

  // Dark bar
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, w, 36, 'F');

  // Accent line
  doc.setFillColor(34, 197, 94); // green-500
  doc.rect(0, 36, w, 2, 'F');

  // Company name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_NAME, 14, 16);

  // Company sub
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 170);
  doc.text(COMPANY_SUB, 14, 24);

  // Title (right)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(title, w - 14, 16, { align: 'right' });

  // Subtitle (right)
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 170);
    doc.text(subtitle, w - 14, 24, { align: 'right' });
  }
};

// Shared professional footer
const drawFooter = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;

  doc.setFillColor(245, 245, 245);
  doc.rect(0, h - 16, w, 16, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${dateStr} — ${COMPANY_NAME}`, 14, h - 6);
  doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, w - 14, h - 6, { align: 'right' });
};

// Shared table styles
const baseTableStyles = {
  theme: 'grid',
  styles: {
    font: 'helvetica',
    fontSize: 8,
    cellPadding: 3,
    lineColor: [220, 220, 225],
    lineWidth: 0.3,
    valign: 'middle',
  },
  headStyles: {
    fillColor: [24, 24, 27],
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 8,
  },
  alternateRowStyles: {
    fillColor: [249, 250, 251],
  },
  margin: { bottom: 20 },
};

// =============================================
// PRÉ-VENDA PDF
// =============================================
export const generatePreVendaPDF = (item) => {
  if (!item || !item.itens || item.itens.length === 0) return;

  try {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const dataObj = new Date(item.data || item.createdAt);

    drawHeader(doc, 'PRÉ-VENDA', `#${item.firebaseId?.slice(-6) || item.id} | ${dataObj.toLocaleDateString('pt-BR')}`);

    // Info section
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, 44, w - 28, 18, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text('Cliente:', 20, 53);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(item.cliente || 'NÃO INFORMADO', 42, 53);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${formatCurrency(item.total)}`, w - 20, 56, { align: 'right' });

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
      startY: 70,
      head: [['Barras', 'Código', 'Descrição', 'Emb', 'Qtd', 'Preço', 'Subtotal']],
      body: tableData,
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 'auto' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const prod = item.itens[data.row.index];
          if (!prod) return;
          const canvas = document.createElement('canvas');
          try {
            JsBarcode(canvas, prod.codigo, { format: 'CODE128', displayValue: false, height: 30, width: 1.5, margin: 0 });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', data.cell.x + 1, data.cell.y + 2, 28, 12);
          } catch (e) { /* silently skip invalid barcodes */ }
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

    // Info
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Responsável: ${item.atribuicao || item.separador || '-'}`, 14, 48);

    const tableData = (item.itens || []).map(prod => [
      prod.codigo,
      prod.descricao,
      prod.embalagem || prod.emb || '',
      prod.estoque || '0',
      prod.qtd?.toString() || '0'
    ]);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 55,
      head: [['Código', 'Descrição', 'Emb', 'Estoque', 'Qtd Pedida']],
      body: tableData,
      styles: { ...baseTableStyles.styles, fontSize: 11, cellPadding: 4 },
      headStyles: { ...baseTableStyles.headStyles, fontSize: 10 },
    });

    drawFooter(doc);
    doc.save(`picking_${item.id || item.firebaseId?.slice(-6)}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Picking:', error);
    alert('Ocorreu um erro ao gerar o PDF.');
  }
};

// =============================================
// RELATÓRIO DE AUDITORIA PDF
// =============================================
export const generateRelatorioPDF = (filteredData, totalInRisk, selectedRazao) => {
  try {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();

    drawHeader(doc, 'AUDITORIA DE ESTOQUE', selectedRazao || 'Relatório Geral');

    // Summary bar
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14, 44, w - 28, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`TOTAL EM RISCO (IDW): ${formatCurrency(totalInRisk)}`, 20, 53);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 65,
      head: [['Código', 'Descrição', 'Razão Social', 'Dias S/ Venda', 'Valor Est.', 'Risco (V×D)']],
      body: filteredData.map(item => [
        item.codigo || item.CODIGO,
        item.descricao || item.DESCRICAO,
        item.razaosocial || item.RAZAOSOCIAL,
        item.dias_sem_venda || '0',
        formatCurrency(item.valor_estoque),
        formatCurrency((Number(item.dias_sem_venda) || 0) * (Number(item.valor_estoque) || 0))
      ]),
    });

    drawFooter(doc);
    doc.save(`relatorio_auditoria_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF de Relatório:', error);
    alert('Ocorreu um erro ao gerar o PDF.');
  }
};

// =============================================
// PEDIDO B2B PDF
// =============================================
export const generateB2BPDF = (pedido) => {
  if (!pedido || !pedido.itens || pedido.itens.length === 0) return;

  try {
    const doc = new jsPDF();

    drawHeader(doc, 'PEDIDO B2B', `#${pedido.firebaseId?.slice(-6) || pedido.id} | ${new Date(pedido.data || pedido.createdAt).toLocaleDateString('pt-BR')}`);

    // Client
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Cliente: ${pedido.cliente || '-'}`, 14, 48);

    const tableData = pedido.itens.map(prod => [
      prod.codigo,
      prod.descricao,
      prod.embalagem || prod.emb || 'UN',
      prod.qtd?.toString() || '0'
    ]);

    autoTable(doc, {
      ...baseTableStyles,
      startY: 55,
      head: [['Código', 'Descrição', 'Emb', 'Qtd Solicitada']],
      body: tableData,
    });

    drawFooter(doc);
    doc.save(`pedido_b2b_${pedido.firebaseId?.slice(-6) || pedido.id}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF B2B:', error);
    alert('Ocorreu um erro ao gerar o PDF.');
  }
};
