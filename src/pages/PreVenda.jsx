import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, CheckSquare, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function PreVenda() {
  const { user, hasPermission } = useAuth();
  const [cart, setCart] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [qtd, setQtd] = useState(1);
  const [preco, setPreco] = useState(0);
  const [atribuicao, setAtribuicao] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);

  // Mock auto-complete for entry
  const handleCodigoChange = (e) => {
    const val = e.target.value;
    setCodigo(val);
    if (val === '1001') {
      setDescricao('REFRIGERANTE COLA 2L');
      setPreco(8.50);
    } else if (val === '1002') {
      setDescricao('SABAO EM PO 1KG');
      setPreco(14.00);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getHistory('Prevendas');
      if (res && res.data) {
        setHistory(res.data);
      } else if (Array.isArray(res)) {
        setHistory(res);
      } else {
        setHistory([
          { id: 'PV-100', data: '10/05/2026', responsavel: 'Lider João', status: 'Aberta', total: 150.00 },
          { id: 'PV-101', data: '11/05/2026', responsavel: 'Repositor Marcos', status: 'Iniciada', total: 45.50 }
        ]);
      }
    } catch (e) {
      console.error(e);
      // fallback
      setHistory([
        { id: 'PV-100', data: '10/05/2026', responsavel: 'Lider João', status: 'Aberta', total: 150.00 },
        { id: 'PV-101', data: '11/05/2026', responsavel: 'Repositor Marcos', status: 'Iniciada', total: 45.50 }
      ]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission('Ver Histórico de Vendas')) {
      loadHistory();
    }
  }, [hasPermission]);

  const addItem = (e) => {
    e.preventDefault();
    if (!codigo || !descricao || qtd <= 0) return;
    
    const newItem = {
      id: Date.now().toString(),
      codigo,
      complemento: '', // mock
      descricao,
      qtd: Number(qtd),
      preco: Number(preco),
      subtotal: Number(qtd) * Number(preco),
      emb: 'UN' // Mock
    };

    setCart([...cart, newItem]);
    setCodigo('');
    setDescricao('');
    setQtd(1);
    setPreco(0);
  };

  const removeItem = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + item.subtotal, 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleEncerrarCompra = async () => {
    if (cart.length === 0) {
      alert("O carrinho está vazio.");
      return;
    }
    if (!atribuicao) {
      alert("Selecione a quem atribuir a pré-venda.");
      return;
    }

    setSaving(true);
    try {
      const pedidoData = {
        data: new Date().toISOString(),
        atribuicao,
        itens: cart,
        total,
        criadoPor: user?.name
      };
      
      await api.createPreVenda(pedidoData);
      alert("Pré-Venda salva com sucesso no sistema!");
      setCart([]);
      setAtribuicao('');
      loadHistory();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar pré-venda.");
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = () => {
    if (cart.length === 0) {
      alert("Carrinho vazio!");
      return;
    }
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(234, 179, 8); // primary yellow
    doc.text("SmartStock ERP", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("Resumo de Pré-Venda", 14, 28);
    doc.setFontSize(11);
    doc.text(`Atribuído a: ${atribuicao || 'Não selecionado'}`, 14, 34);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 40);
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`Total Geral: ${formatCurrency(total)}`, 140, 28);

    const tableData = [];
    
    cart.forEach(item => {
      tableData.push([
        { content: "", styles: { minCellHeight: 25 } }, // Placeholder for barcode image
        item.codigo,
        item.descricao,
        item.emb,
        item.qtd.toString(),
        formatCurrency(item.preco),
        formatCurrency(item.subtotal)
      ]);
    });

    doc.autoTable({
      startY: 45,
      head: [['Cod. Barras', 'Código', 'Descrição', 'Emb', 'Qtd', 'Preço', 'Subtotal']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [234, 179, 8], textColor: 255, fontStyle: 'bold' },
      styles: { valign: 'middle', fontSize: 10 },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const item = cart[data.row.index];
          const canvas = document.createElement("canvas");
          const codeStr = item.codigo + (item.complemento ? `-${item.complemento}` : '');
          try {
            JsBarcode(canvas, codeStr, { format: "CODE128", displayValue: false, height: 40, width: 2, margin: 0 });
            const barcodeDataUrl = canvas.toDataURL("image/png");
            doc.addImage(barcodeDataUrl, 'PNG', data.cell.x + 2, data.cell.y + 4, 30, 15);
          } catch (e) {
            console.error("Barcode generation failed for", codeStr, e);
          }
        }
      }
    });

    doc.save("pre_venda.pdf");
  };

  const toggleHistorySelection = (id) => {
    if (selectedHistory.includes(id)) {
      setSelectedHistory(selectedHistory.filter(i => i !== id));
    } else {
      setSelectedHistory([...selectedHistory, id]);
    }
  };

  const handleDeleteHistory = () => {
    if (selectedHistory.length === 0) return;
    if (window.confirm(`Deseja excluir ${selectedHistory.length} pré-venda(s)?`)) {
      // call API in real app
      setHistory(history.filter(h => !selectedHistory.includes(h.id)));
      setSelectedHistory([]);
      alert("Excluído com sucesso (Mock).");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Pré-Venda</h1>
        <p className="text-muted-foreground mt-1">Crie, gerencie pedidos e emita relatórios.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl shadow-sm p-6 h-fit">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <Plus size={24} className="text-primary" />
            Adicionar Item
          </h2>
          <form onSubmit={addItem} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Código do Produto</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                value={codigo}
                onChange={handleCodigoChange}
                placeholder="Ex: 1001"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Descrição</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted/50 text-muted-foreground font-medium"
                value={descricao}
                readOnly
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold py-3 rounded-lg transition-colors mt-2 border border-border"
            >
              Inserir no Carrinho
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <label className="block text-sm font-semibold text-foreground mb-2">Atribuir Separação a</label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              value={atribuicao}
              onChange={(e) => setAtribuicao(e.target.value)}
            >
              <option value="">Selecione um responsável</option>
              <option value="Lider João">Líder João</option>
              <option value="Repositor Marcos">Repositor Marcos</option>
              <option value="Repositora Ana">Repositora Ana</option>
            </select>
          </div>
        </div>

        {/* Right Cart Area */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col min-h-[350px]">
            <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart size={24} className="text-primary" />
                Carrinho
              </h2>
              <span className="text-sm font-bold bg-background border border-border px-3 py-1 rounded-full">{cart.length} itens</span>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-semibold text-xs uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-5 py-4">Código</th>
                    <th className="px-5 py-4">Descrição</th>
                    <th className="px-5 py-4 text-center">Qtd</th>
                    <th className="px-5 py-4 text-right">Preço</th>
                    <th className="px-5 py-4 text-right">Subtotal</th>
                    <th className="px-5 py-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-muted-foreground font-medium">
                        Seu carrinho está vazio. Comece adicionando itens.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-4 font-bold">{item.codigo}</td>
                        <td className="px-5 py-4 font-medium">{item.descricao}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="bg-background border border-border px-3 py-1.5 rounded-lg text-sm font-bold">
                            {item.qtd}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-medium">{formatCurrency(item.preco)}</td>
                        <td className="px-5 py-4 text-right font-bold text-primary">{formatCurrency(item.subtotal)}</td>
                        <td className="px-5 py-4 text-center">
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                {hasPermission('Gerar PDF Pré-Venda') && (
                  <button 
                    onClick={generatePDF}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-background hover:bg-muted text-foreground border border-border font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
                  >
                    <FileText size={20} className="text-primary" />
                    Baixar PDF
                  </button>
                )}
                <button 
                  onClick={handleEncerrarCompra}
                  disabled={cart.length === 0 || saving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-3 px-8 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Encerrar Compra
                </button>
              </div>
              <div className="bg-card border border-border px-6 py-3 rounded-xl shadow-sm text-right w-full sm:w-auto">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Geral</p>
                <p className="text-3xl font-black text-foreground">{formatCurrency(total)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Vendas */}
      {hasPermission('Ver Histórico de Vendas') && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col mt-8">
          <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History size={24} className="text-primary" />
              Histórico de Pré-Vendas
            </h2>
            {selectedHistory.length > 0 && (
              <button 
                onClick={handleDeleteHistory}
                className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg font-bold text-sm hover:bg-destructive/90 transition-colors shadow-sm"
              >
                <Trash2 size={16} /> Excluir ({selectedHistory.length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-xs border-b border-border">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">
                    <CheckSquare size={16} className="mx-auto" />
                  </th>
                  <th className="px-5 py-4">ID Pedido</th>
                  <th className="px-5 py-4">Data</th>
                  <th className="px-5 py-4">Responsável</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLoading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-8 text-center text-muted-foreground">
                      <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                      Carregando histórico...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-8 text-center text-muted-foreground font-medium">
                      Nenhum histórico encontrado.
                    </td>
                  </tr>
                ) : (
                  history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                          checked={selectedHistory.includes(h.id)}
                          onChange={() => toggleHistorySelection(h.id)}
                        />
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">{h.id}</td>
                      <td className="px-5 py-4 font-medium">{h.data}</td>
                      <td className="px-5 py-4">{h.responsavel}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                          h.status === 'Aberta' ? 'bg-muted text-muted-foreground border-border' : 
                          h.status === 'Finalizada' ? 'bg-success/10 text-success border-success/20' : 
                          'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold">{formatCurrency(h.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
