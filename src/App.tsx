/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Download, 
  Sparkles,
  Clipboard,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Trash2,
  Upload,
  Loader2
} from 'lucide-react';
import { analyzeCV, optimizeCV, AnalysisResponse, ImprovementItem } from './services/geminiService.ts';
import { extractTextFromFile } from './lib/fileParser.ts';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Step = 'IDLE' | 'ANALYZING' | 'REPORT' | 'OPTIMIZING' | 'FINISHED';
type TemplateType = 'PROFESSIONAL' | 'MINIMAL' | 'MODERN' | 'EXECUTIVE';

// Component for the high-fidelity professional CV template
const CVTemplate = React.forwardRef<HTMLDivElement, { content: string, template: TemplateType }>(({ content, template }, ref) => {
  const getTemplateStyles = () => {
    switch (template) {
      case 'MINIMAL':
        return {
          h1: "text-[28px] font-light tracking-tight text-[#111827] mb-2 uppercase border-b border-[#F3F4F6] pb-2",
          h2: "text-[12px] font-bold tracking-[2px] text-[#6B7280] uppercase mt-8 mb-4",
          line: "hidden",
          headerColor: "text-[#9CA3AF]",
          accentColor: "#111827",
          font: "font-sans"
        };
      case 'MODERN':
        return {
          h1: "text-[36px] font-black tracking-tighter text-[#1A1A1A] mb-1 leading-none",
          h2: "text-[14px] font-bold tracking-tight text-white bg-[#1A1A1A] px-2 py-0.5 inline-block mt-6 mb-3",
          line: "hidden",
          headerColor: "text-[#6B7280]",
          accentColor: "#1A1A1A",
          font: "font-sans"
        };
      case 'EXECUTIVE':
        return {
          h1: "text-[30px] font-serif font-bold text-[#1e293b] mb-1",
          h2: "text-[13px] font-bold border-b-2 border-[#1e293b] text-[#1e293b] uppercase mt-6 mb-3 pb-1",
          line: "hidden",
          headerColor: "text-[#475569]",
          accentColor: "#0f172a",
          font: "font-serif"
        };
      default: // PROFESSIONAL
        return {
          h1: "text-[32px] font-bold tracking-tight text-[#111827] mb-1 uppercase",
          h2: "text-[14px] font-bold tracking-widest text-[#2563EB] uppercase mt-6 mb-3",
          line: "h-[1px] bg-[#2563eb] w-full mt-0.5 opacity-40",
          headerColor: "text-[#4B5563]",
          accentColor: "#2563EB",
          font: "font-sans"
        };
    }
  };

  const styles = getTemplateStyles();

  return (
    <div 
      ref={ref} 
      className={`bg-white text-[#1A1A1A] p-[15mm] md:p-[20mm] w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl print:shadow-none leading-relaxed text-left overflow-visible ${styles.font}`}
      style={{ boxSizing: 'border-box', color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
    >
      <div className="cv-content-wrapper printable-area" style={{ backgroundColor: '#FFFFFF' }}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className={`${styles.h1} break-inside-avoid`} style={{ color: '#111827' }}>{children}</h1>
            ),
            h2: ({ children }) => (
              <div className="mt-4 mb-3 break-inside-avoid" style={{ borderBottom: styles.line === 'hidden' ? 'none' : '1px solid #2563eb44' }}>
                <h2 className={styles.h2} style={{ color: template === 'MODERN' ? '#FFFFFF' : (template === 'PROFESSIONAL' ? '#2563EB' : (template === 'EXECUTIVE' ? '#1E293B' : '')), backgroundColor: template === 'MODERN' ? '#1A1A1A' : 'transparent' }}>
                  {children}
                </h2>
              </div>
            ),
            h3: ({ children }) => (
              <h3 className="text-[14px] font-bold text-[#111827] mt-3 mb-0.5 break-inside-avoid" style={{ color: '#111827' }}>{children}</h3>
            ),
            p: ({ children }) => {
              const text = String(children);
              if (text === '---' || text === '***') return null;

              if (text.includes(' • ') || (text.includes('@') && text.includes('.'))) {
                return (
                  <p className={`text-[11px] font-medium mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 break-inside-avoid`} style={{ color: template === 'MINIMAL' ? '#9CA3AF' : (template === 'EXECUTIVE' ? '#475569' : '#4B5563') }}>
                    {children}
                  </p>
                );
              }
              if (text.includes('|') && (text.length < 100)) {
                 return <p className="text-[12px] font-semibold -mt-1 mb-1 break-inside-avoid" style={{ color: styles.accentColor }}>{children}</p>;
              }
              return <p className="text-[13px] text-[#374151] mb-2 leading-relaxed" style={{ color: '#374151' }}>{children}</p>;
            },
            ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-4" style={{ listStyleType: 'disc' }}>{children}</ul>,
            li: ({ children }) => <li className="text-[12.5px] text-[#374151] pl-1 break-inside-avoid" style={{ color: '#374151' }}>{children}</li>,
            a: ({ children }) => <span className="text-inherit" style={{ textDecoration: 'none', color: 'inherit' }}>{children}</span>,
            strong: ({ children }) => <strong className="font-bold text-[#111827]" style={{ color: '#111827' }}>{children}</strong>
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});

export default function App() {
  const [step, setStep] = useState<Step>('IDLE');
  const [template, setTemplate] = useState<TemplateType>('PROFESSIONAL');
  const [cvText, setCvText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<number[]>([]);
  const [optimizedCV, setOptimizedCV] = useState('');
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    try {
      const text = await extractTextFromFile(file);
      setCvText(text);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error al leer el archivo. Asegúrate de que sea un PDF o DOCX válido.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleChangeSelection = (index: number) => {
    setSelectedChanges(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Use the html method for better autoPaging support
      await pdf.html(element, {
        callback: function (pdfDoc) {
          pdfDoc.save('CV_Optimizado_Core_IT.pdf');
          setIsExporting(false);
        },
        autoPaging: 'text',
        x: 0,
        y: 0,
        width: pdfWidth, 
        windowWidth: 794, // Standard A4 width at 96 DPI
      });
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error en la exportación profesional. Intenta con otra plantilla.');
      setIsExporting(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const text = await extractTextFromFile(file);
      setCvText(text);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error al leer el archivo.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!cvText.trim()) return;
    setLoading(true);
    setStep('ANALYZING');
    try {
      const result = await analyzeCV(cvText);
      setAnalysis(result);
      setSelectedChanges(result.improvementPlan.map((_, i) => i));
      setStep('REPORT');
    } catch (error) {
      console.error('Error analyzing CV:', error);
      setStep('IDLE');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!cvText || !analysis) return;
    setLoading(true);
    setStep('OPTIMIZING');
    try {
      const activePlan = analysis.improvementPlan.filter((_, i) => selectedChanges.includes(i));
      const result = await optimizeCV(cvText, activePlan);
      setOptimizedCV(result);
      setStep('FINISHED');
    } catch (error) {
      console.error('Error optimizing CV:', error);
      setStep('REPORT');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('IDLE');
    setCvText('');
    setAnalysis(null);
    setOptimizedCV('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado al portapapeles');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#E2E8F0]">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" id="app-logo">
            <div className="bg-[#1A1A1A] p-1.5 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">CV Optimizer <span className="text-[#6B7280] font-normal">Pro</span></span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-[#6B7280]">
            <span className={step === 'IDLE' ? 'text-[#1A1A1A]' : ''}>1. Entrada</span>
            <ArrowRight className="w-4 h-4 opacity-30" />
            <span className={step === 'REPORT' ? 'text-[#1A1A1A]' : ''}>2. Auditoría</span>
            <ArrowRight className="w-4 h-4 opacity-30" />
            <span className={step === 'FINISHED' ? 'text-[#1A1A1A]' : ''}>3. Optimización</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 'IDLE' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
              id="step-idle"
            >
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <h1 className="text-4xl font-bold tracking-tight text-[#111827]">
                  Tu próximo empleo empieza con un CV optimizado.
                </h1>
                <p className="text-[#6B7280] text-lg">
                  Carga tu experiencia profesional y deja que nuestra IA audite tu perfil con estándares de reclutamiento IT.
                </p>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-1 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between px-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40" />
                    <div className="w-3 h-3 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/40" />
                    <div className="w-3 h-3 rounded-full bg-[#10B981]/20 border border-[#10B981]/40" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">CV_INPUT_ENGINE</span>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* File Upload Zone */}
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className={`border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group ${isParsing ? 'bg-[#F9FAFB] border-[#E5E7EB]' : 'border-[#E5E7EB] hover:border-[#1A1A1A] hover:bg-[#F9FAFB]'}`}
                    onClick={() => !isParsing && fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".pdf,.docx,.txt" 
                      className="hidden" 
                    />
                    {isParsing ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[#1A1A1A] animate-spin" />
                        <p className="text-sm font-medium text-[#1A1A1A]">Extrayendo texto del documento...</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-[#F3F4F6] rounded-full group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[#111827]">Sube tu CV (PDF, DOCX)</p>
                          <p className="text-xs text-[#6B7280] mt-1">Arrastra y suelta o haz clic para seleccionar</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#F3F4F6]"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest font-mono text-[#9CA3AF]">
                      <span className="bg-white px-4">o pega el texto directamente</span>
                    </div>
                  </div>

                  <div>
                    <textarea
                      className="w-full h-60 p-4 border border-[#F3F4F6] rounded-xl focus:ring-1 focus:ring-[#1A1A1A] focus:border-[#1A1A1A] text-[#374151] font-mono text-sm resize-none placeholder:text-[#9CA3AF] transition-all"
                      placeholder="Experiencia, Educación, Skills..."
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      id="cv-textarea"
                    />
                    <div className="mt-4 flex justify-end gap-3 items-center">
                      {cvText && (
                        <button 
                          onClick={() => setCvText('')}
                          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-[#EF4444] transition-colors p-2"
                          title="Limpiar"
                        >
                          <Trash2 className="w-4 h-4" />
                          Limpiar
                        </button>
                      )}
                      <button
                        onClick={handleAnalyze}
                        disabled={!cvText.trim() || loading || isParsing}
                        className="flex items-center gap-2 bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/5"
                        id="analyze-button"
                      >
                        Auditar Profesionalismo
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(step === 'ANALYZING' || step === 'OPTIMIZING') && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 space-y-6"
              id="step-loading"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#F3F4F6] border-t-[#1A1A1A] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-[#1A1A1A]" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold uppercase tracking-widest text-[#1A1A1A]">
                  {step === 'ANALYZING' ? 'Auditoría en proceso' : 'Optimizando jerarquía viva'}
                </h3>
                <p className="text-[#6B7280] font-mono text-xs mt-2">
                  {step === 'ANALYZING' ? 'ANALYZING_ATS_MARKET_PATTERNS...' : 'GENERATING_OUTPUT_MODEL_V3...'}
                </p>
              </div>
            </motion.div>
          )}

          {step === 'REPORT' && analysis && (
            <motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-10"
              id="step-report"
            >
              {/* Health Report Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#10B981]" />
                  <h2 className="text-2xl font-bold tracking-tight">Reporte de Salud Profesional</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score */}
                  <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center space-y-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-24 h-24" />
                    </div>
                    <span className="text-sm font-mono uppercase tracking-widest text-[#6B7280]">Puntuación de Impacto</span>
                    <span className="text-6xl font-black text-[#1A1A1A]">{analysis.report.score}<span className="text-2xl font-normal text-[#9CA3AF]">/100</span></span>
                  </div>

                  {/* Keywords */}
                  <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-[#E5E7EB] space-y-4">
                    <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-2">
                      <Search className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-sm font-mono uppercase tracking-widest text-[#6B7280]">Análisis de Keywords ATS</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.report.keywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs font-medium text-[#374151]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#FEF2F2] border border-[#FEE2E2] p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-[#EF4444]" />
                    <h4 className="text-[#991B1B] font-bold uppercase tracking-wider text-sm">Debilidades Críticas</h4>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.report.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#B91C1C]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[#EF4444]" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Improvement Plan */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-[#3B82F6]" />
                    <h2 className="text-2xl font-bold tracking-tight">Plan de Mejora</h2>
                  </div>
                  <div className="px-4 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold font-mono">
                    {selectedChanges.length} / {analysis.improvementPlan.length} SELECCIONADOS
                  </div>
                </div>

                <div className="overflow-hidden border border-[#E5E7EB] rounded-2xl bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-[#6B7280] w-[10%]">Sel.</th>
                        <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-[#6B7280] w-[15%]">Sección</th>
                        <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-[#6B7280] w-[30%]">Original</th>
                        <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-[#6B7280] w-[45%]">Propuesta de IA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {analysis.improvementPlan.map((item, i) => (
                        <tr key={i} className={`group transition-colors ${selectedChanges.includes(i) ? 'bg-[#F0FDF4]/30' : 'hover:bg-[#F9FAFB]/50'}`}>
                          <td className="px-6 py-6 align-top">
                            <input 
                              type="checkbox"
                              checked={selectedChanges.includes(i)}
                              onChange={() => toggleChangeSelection(i)}
                              className="w-5 h-5 rounded border-[#D1D5DB] text-[#1A1A1A] focus:ring-[#1A1A1A] cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-6 font-semibold align-top">{item.section}</td>
                          <td className="px-6 py-6 text-sm text-[#6B7280] align-top">{item.original}</td>
                          <td className="px-6 py-6 align-top">
                            <div className="space-y-3">
                              <p className={`text-sm font-medium p-3 rounded-lg border transition-all ${selectedChanges.includes(i) ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#111827]' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF]'}`}>
                                {item.proposed}
                              </p>
                              <p className="text-[11px] text-[#059669] italic flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3" />
                                {item.reason}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Final Step Confirmation */}
              <div className="bg-[#1A1A1A] p-10 rounded-3xl text-center space-y-6 shadow-2xl">
                <div className="max-w-xl mx-auto space-y-2">
                  <h3 className="text-white text-2xl font-bold">¿Deseas aplicar estos cambios automáticamente?</h3>
                  <p className="text-[#9CA3AF]">
                    Se aplicarán los <span className="text-white font-bold">{selectedChanges.length} cambios</span> que has seleccionado para generar tu CV optimizado.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={handleOptimize}
                    disabled={selectedChanges.length === 0}
                    className="w-full sm:w-auto px-10 py-4 bg-white text-[#1A1A1A] rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100"
                    id="confirm-optimize"
                  >
                    Aplicar {selectedChanges.length} Cambios
                  </button>
                  <button 
                    onClick={() => setStep('IDLE')}
                    className="w-full sm:w-auto px-10 py-4 border border-white/20 text-white rounded-2xl font-medium hover:bg-white/10 transition-colors"
                  >
                    Ajustar sección primero
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'FINISHED' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
              id="step-finished"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#10B981]/10 text-[#10B981] rounded-full mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">CV Optimizado con Éxito</h1>
                <p className="text-[#6B7280]">Tu perfil ahora cumple con los estándares de reclutamiento más exigentes del sector IT.</p>
              </div>

              <div className="bg-[#F3F4F6] border-2 border-[#1A1A1A] rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
                <div className="p-4 border-b border-[#E5E7EB] bg-white flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#2563EB]" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">PREVIEW_PROFESSIONAL_v1.0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(optimizedCV)}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Clipboard className="w-4 h-4" />
                      Copiar
                    </button>
                    <button 
                      className="bg-[#1A1A1A] text-white px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 hover:bg-[#333333]"
                      onClick={handleExportPDF}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isExporting ? 'Generando...' : 'Descargar PDF'}
                    </button>
                  </div>
                </div>
                
                {/* Template Selector */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white border border-[#E5E7EB] rounded-2xl">
                  <div className="text-left space-y-1">
                    <h4 className="font-bold text-[#111827]">Selecciona una plantilla</h4>
                    <p className="text-xs text-[#6B7280]">Personaliza el impacto visual de tu perfil</p>
                  </div>
                  <div className="flex gap-3">
                    {[
                      { id: 'PROFESSIONAL', name: 'Profesional', icon: <ShieldCheck className="w-3 h-3" /> },
                      { id: 'MINIMAL', name: 'Minimalista', icon: <FileText className="w-3 h-3" /> },
                      { id: 'MODERN', name: 'Moderno', icon: <Sparkles className="w-3 h-3" /> },
                      { id: 'EXECUTIVE', name: 'Ejecutivo', icon: <TrendingUp className="w-3 h-3" /> }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id as TemplateType)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                          template === t.id 
                            ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-lg scale-105' 
                            : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1A1A1A]'
                        }`}
                      >
                        {t.icon}
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Scrollable Preview Area */}
                <div className="overflow-y-auto max-h-[75vh] p-4 md:p-12">
                   <CVTemplate ref={printRef} content={optimizedCV} template={template} />
                </div>
              </div>

              <div className="flex justify-center">
                <button 
                  onClick={resetForm}
                  className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] font-medium transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Optimizar otro CV
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-6 text-center text-[#9CA3AF] text-sm">
          <p>© 2026 CV Optimizer Engine. Potenciado por Inteligencia Artificial de Google.</p>
          <div className="flex justify-center gap-6 mt-4">
            <span className="cursor-pointer hover:text-[#1A1A1A]">Privacidad</span>
            <span className="cursor-pointer hover:text-[#1A1A1A]">Términos</span>
            <span className="cursor-pointer hover:text-[#1A1A1A]">Contacto</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
