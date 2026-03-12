import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { analyzeDocument, chatWithDoc, performForensicScan, getUsageStats } from './services/geminiService';
import NetworkGraph from './components/NetworkGraph';
import { ArchitectureNode, ArchitectureLink, DocumentAnalysis, Message, PermissionAssessment, ForensicHistoryItem } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// -----------------------------
// UTILITY FUNCTIONS
// -----------------------------
const getRiskColor = (risk?: string) => {
  switch (risk?.toLowerCase()) {
    case 'critical': return 'text-rose-500 border-rose-500/50 bg-rose-500/10';
    case 'high': return 'text-orange-500 border-orange-500/50 bg-orange-500/10';
    case 'medium': return 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10';
    default: return 'text-cyan-500 border-cyan-500/50 bg-cyan-500/10';
  }
};

const formatTimestamp = (date: Date) => date.toLocaleTimeString();

// -----------------------------
// BANNER COMPONENT
// -----------------------------
interface BannerProps { message: string; type: 'error' | 'warning'; onDismiss: () => void; }
const Banner: React.FC<BannerProps> = ({ message, type, onDismiss }) => {
  const baseClass = "text-white text-[10px] font-black tracking-[0.2em] py-2 px-6 flex items-center justify-between uppercase animate-in slide-in-from-top duration-500 sticky top-0 z-[110]";
  const bgClass = type === 'error' ? 'bg-rose-600' : 'bg-amber-600';
  const icon = type === 'error' ? '⚠' : '⚡';
  return (
    <div className={`${baseClass} ${bgClass}`}>
      <span className="flex items-center"><span className="mr-3 text-sm">{icon}</span>{message}</span>
      <button onClick={onDismiss} className="hover:opacity-70">DISMISS</button>
    </div>
  );
};

// -----------------------------
// HEADER COMPONENT
// -----------------------------
interface HeaderProps { activeTab: string; setActiveTab: (tab: any) => void; }
const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => (
  <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-2xl sticky top-0 z-[100]">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <span className="text-white font-black text-xl">X</span>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-widest text-white uppercase italic">Sentient-X</h1>
          <p className="text-[10px] font-mono text-cyan-500 font-bold">NODE: DELTA-OSINT-9</p>
        </div>
      </div>
      <nav className="hidden md:flex space-x-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/50">
        {['overview', 'graph', 'permissions', 'forensics', 'refactor'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all duration-300 uppercase tracking-[0.2em] ${
              activeTab === tab ? 'bg-cyan-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  </header>
);

// -----------------------------
// OVERVIEW PANEL
// -----------------------------
interface OverviewPanelProps { analysis: DocumentAnalysis; }
const OverviewPanel: React.FC<OverviewPanelProps> = ({ analysis }) => (
  <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-10 shadow-3xl relative overflow-hidden group animate-in slide-in-from-bottom-6 duration-700">
    <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
    <div className="flex items-center justify-between mb-10">
      <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center">
        <span className="w-1.5 h-10 bg-gradient-to-b from-cyan-400 to-cyan-600 mr-5 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></span> 
        Strategic Intelligence
      </h2>
      <div className={`px-5 py-1.5 rounded-full border-2 font-black text-[11px] tracking-[0.3em] uppercase ${getRiskColor(analysis.threatLevel)}`}>
        {analysis.threatLevel} Threat
      </div>
    </div>
    <p className="text-slate-300 text-xl leading-relaxed mb-10 first-letter:text-7xl first-letter:font-black first-letter:text-cyan-500 first-letter:mr-4 first-letter:float-left drop-shadow-sm font-light">
      {analysis.summary}
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {analysis.keyInsights.map((insight, idx) => (
        <div key={idx} className="bg-slate-800/40 p-6 rounded-[32px] border border-slate-700/30 hover:border-cyan-500/40 transition-all duration-500 group/item hover:bg-slate-800/60">
          <p className="text-sm text-slate-400 flex items-start group-hover/item:text-slate-200 transition-colors">
            <span className="text-cyan-500 font-mono font-black mr-4 mt-1 text-xs">[{idx+1}]</span>
            {insight}
          </p>
        </div>
      ))}
    </div>
  </section>
);

// -----------------------------
// GRAPH PANEL
// -----------------------------
const GraphPanel: React.FC = () => (
  <div className="h-[750px] flex flex-col space-y-8 animate-in zoom-in-95 duration-700">
    <div className="flex-1 rounded-[40px] overflow-hidden border border-slate-800 shadow-2xl relative bg-slate-950 min-h-0">
      <NetworkGraph nodes={INITIAL_NODES} links={INITIAL_LINKS} />
    </div>
  </div>
);

// -----------------------------
// PERMISSIONS PANEL
// -----------------------------
interface PermissionsPanelProps { analysis: DocumentAnalysis; permSearch: string; setPermSearch: (value: string) => void; }
const PermissionsPanel: React.FC<PermissionsPanelProps> = ({ analysis, permSearch, setPermSearch }) => {
  const filteredPermissions = useMemo(() => {
    const query = permSearch.toLowerCase();
    return analysis.permissions.filter(p => [p.name, p.risk, p.description, p.rationale].some(f => f.toLowerCase().includes(query)));
  }, [analysis.permissions, permSearch]);

  return (
    <div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
      <div className="sticky top-[80px] z-50">
        <div className="relative group">
          <input
            type="text"
            placeholder="FILTER BY PERMISSION, RISK LEVEL, OR VECTOR DESCRIPTION..."
            value={permSearch}
            onChange={e => setPermSearch(e.target.value)}
            className="w-full bg-slate-900/95 backdrop-blur-xl border-2 border-slate-800 rounded-3xl py-6 px-10 text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700 shadow-2xl"
          />
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center space-x-4">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{filteredPermissions.length} Results</span>
            <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredPermissions.map((perm, idx) => (
          <div key={idx} className="bg-slate-900/60 border border-slate-800 p-8 rounded-[40px] shadow-2xl transition-all duration-500 group">
            <div className="flex justify-between items-start mb-6">
              <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950/50 px-4 py-1.5 rounded-2xl border border-cyan-800/30 uppercase tracking-tight">{perm.name}</span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-xl border-2 uppercase tracking-widest ${getRiskColor(perm.risk)}`}>
                {perm.risk}
              </span>
            </div>
            <p className="text-slate-300 text-base mb-6 leading-relaxed font-light">{perm.description}</p>
            <details className="group/details border-t border-slate-800/50">
              <summary className="list-none cursor-pointer flex items-center justify-between py-4 text-[11px] font-black text-slate-500 hover:text-cyan-400 uppercase tracking-[0.3em] transition-colors">
                <span>RISK & RATIONALE</span>
                <svg className="w-5 h-5 transform group-open/details:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50">
                  <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-cyan-500/30 pl-4">
                    {perm.rationale}
                  </p>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------
// (Other Panels: ForensicPanel, RefactorPanel, ChatPanel)
// -----------------------------
// Due to length, these can follow same modular pattern as OverviewPanel & PermissionsPanel.
// Each gets its own props, memoization, and DRY logic for copy/download/history management.

export default App;      case 'high': return 'text-orange-500 border-orange-500/50 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10';
      default: return 'text-cyan-500 border-cyan-500/50 bg-cyan-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans select-none">
      {/* Global Error Banner */}
      {errorMsg && (
        <div className="bg-rose-600 text-white text-[10px] font-black tracking-[0.2em] py-2 px-6 flex items-center justify-between uppercase animate-in slide-in-from-top duration-500 sticky top-0 z-[110]">
          <span className="flex items-center"><span className="mr-3 text-sm">⚠</span> {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="hover:opacity-70">DISMISS</button>
        </div>
      )}
      {/* Quota Warning Banner */}
      {quotaWarning && (
        <div className="bg-amber-600 text-white text-[10px] font-black tracking-[0.2em] py-2 px-6 flex items-center justify-between uppercase animate-in slide-in-from-top duration-500 sticky top-0 z-[110]">
          <span className="flex items-center"><span className="mr-3 text-sm">⚡</span> {quotaWarning}</span>
          <button onClick={() => setQuotaWarning(null)} className="hover:opacity-70">DISMISS</button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-2xl sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-white font-black text-xl">X</span>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest text-white uppercase italic">Sentient-X</h1>
              <p className="text-[10px] font-mono text-cyan-500 font-bold">NODE: DELTA-OSINT-9</p>
            </div>
          </div>
          <nav className="hidden md:flex space-x-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/50">
            {['overview', 'graph', 'permissions', 'forensics', 'refactor'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all duration-300 uppercase tracking-[0.2em] ${
                  activeTab === tab ? 'bg-cyan-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8 h-full">
          {loading ? (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center space-y-8 bg-slate-900/30 rounded-[40px] border border-slate-800/50 backdrop-blur-md">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-cyan-500/5 border-t-cyan-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-full animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.3)]"></div>
                </div>
              </div>
              <div className="text-center animate-pulse">
                <p className="font-mono text-xs text-cyan-400 tracking-[0.5em] font-black uppercase">Decrypting Neural Enclaves...</p>
                <p className="text-[9px] text-slate-500 mt-3 font-mono uppercase">Node Synchronization Pending</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && analysis && (
                <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
                  <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-10 shadow-3xl relative overflow-hidden group">
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
                    <div className="flex items-center justify-between mb-10">
                      <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center">
                        <span className="w-1.5 h-10 bg-gradient-to-b from-cyan-400 to-cyan-600 mr-5 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></span> 
                        Strategic Intelligence
                      </h2>
                      <div className={`px-5 py-1.5 rounded-full border-2 font-black text-[11px] tracking-[0.3em] uppercase ${getRiskColor(analysis.threatLevel)}`}>
                        {analysis.threatLevel} Threat
                      </div>
                    </div>
                    <p className="text-slate-300 text-xl leading-relaxed mb-10 first-letter:text-7xl first-letter:font-black first-letter:text-cyan-500 first-letter:mr-4 first-letter:float-left drop-shadow-sm font-light">
                      {analysis.summary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {analysis.keyInsights.map((insight, idx) => (
                        <div key={idx} className="bg-slate-800/40 p-6 rounded-[32px] border border-slate-700/30 hover:border-cyan-500/40 transition-all duration-500 group/item hover:bg-slate-800/60">
                          <p className="text-sm text-slate-400 flex items-start group-hover/item:text-slate-200 transition-colors">
                            <span className="text-cyan-500 font-mono font-black mr-4 mt-1 text-xs">[{idx+1}]</span>
                            {insight}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'graph' && (
                <div className="h-[750px] flex flex-col space-y-8 animate-in zoom-in-95 duration-700">
                  <div className="flex-1 rounded-[40px] overflow-hidden border border-slate-800 shadow-2xl relative bg-slate-950 min-h-0">
                    <NetworkGraph nodes={INITIAL_NODES} links={INITIAL_LINKS} />
                  </div>
                </div>
              )}

              {activeTab === 'permissions' && analysis && (
                <div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
                  <div className="sticky top-[80px] z-50">
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="FILTER BY PERMISSION, RISK LEVEL, OR VECTOR DESCRIPTION..."
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="w-full bg-slate-900/95 backdrop-blur-xl border-2 border-slate-800 rounded-3xl py-6 px-10 text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700 shadow-2xl"
                      />
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center space-x-4">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{filteredPermissions.length} Results</span>
                        <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredPermissions.map((perm, idx) => (
                      <div key={idx} className="bg-slate-900/60 border border-slate-800 p-8 rounded-[40px] shadow-2xl transition-all duration-500 group">
                        <div className="flex justify-between items-start mb-6">
                          <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950/50 px-4 py-1.5 rounded-2xl border border-cyan-800/30 uppercase tracking-tight">{perm.name}</span>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-xl border-2 uppercase tracking-widest ${getRiskColor(perm.risk)}`}>
                            {perm.risk}
                          </span>
                        </div>
                        <p className="text-slate-300 text-base mb-6 leading-relaxed font-light">{perm.description}</p>
                        <details className="group/details border-t border-slate-800/50">
                          <summary className="list-none cursor-pointer flex items-center justify-between py-4 text-[11px] font-black text-slate-500 hover:text-cyan-400 uppercase tracking-[0.3em] transition-colors">
                            <span>RISK & RATIONALE</span>
                            <svg className="w-5 h-5 transform group-open/details:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50">
                              <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-cyan-500/30 pl-4">
                                {perm.rationale}
                              </p>
                            </div>
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'forensics' && (
                <div className="space-y-10 animate-in zoom-in-95 duration-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-8 shadow-3xl flex flex-col h-full min-h-[500px]">
                      <h2 className="text-xl font-black text-white uppercase tracking-[0.4em] mb-10 flex items-center">
                        <span className="w-3 h-3 bg-cyan-500 rounded-full mr-4 shadow-[0_0_15px_rgba(6,182,212,0.8)]"></span>
                        Forensic Entity Lab
                      </h2>
                      <div className="flex-1 flex flex-col space-y-6">
                        <div className="relative group">
                          <input 
                            type="text" 
                            placeholder="TARGET SIGNATURE / DOMAIN / IP..."
                            value={forensicQuery}
                            onChange={(e) => setForensicQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleForensicScan(false)}
                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-5 px-8 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-800"
                          />
                          <button 
                            onClick={() => handleForensicScan(false)}
                            disabled={scanning}
                            className={`absolute right-3 top-2 bottom-2 px-8 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${
                              scanning 
                                ? 'bg-cyan-900/10 text-cyan-500/50 cursor-not-allowed overflow-hidden' 
                                : 'bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white shadow-xl shadow-cyan-900/30'
                            }`}
                          >
                            {scanning ? (
                               <span className="flex items-center space-x-2">
                                 <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
                                 <span className="animate-pulse">Active Scan</span>
                               </span>
                            ) : 'Execute Scan'}
                          </button>
                        </div>
                        <div className="flex-1 bg-slate-950 rounded-[32px] border border-slate-800/80 p-8 font-mono text-[11px] overflow-y-auto shadow-inner">
                          {scanning ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-4 text-cyan-500/50">
                              <div className="w-10 h-10 border-4 border-cyan-500/5 border-t-cyan-500 rounded-full animate-spin"></div>
                              <p className="animate-pulse uppercase tracking-widest">Penetrating Global OSINT Repositories...</p>
                            </div>
                          ) : forensicResult ? (
                            <div className="space-y-8 animate-in fade-in duration-700">
                              <div className="flex flex-wrap justify-end gap-3 mb-4">
                                <button onClick={handleCopyResult} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-cyan-400 transition-colors uppercase tracking-widest text-[9px] font-black">Copy</button>
                                <button onClick={handleDownloadResult} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-cyan-400 transition-colors uppercase tracking-widest text-[9px] font-black">Download</button>
                                <button onClick={handleDeepScan} className="px-4 py-2 bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-500/30 rounded-xl text-cyan-400 transition-colors flex items-center uppercase tracking-widest text-[9px] font-black"><span className="mr-2">⚡</span> Deep Scan</button>
                              </div>
                              <p className={`text-slate-300 leading-relaxed whitespace-pre-wrap text-sm border-l-2 pl-6 py-2 ${forensicResult.text.includes('429') ? 'border-rose-500 text-rose-300' : 'border-cyan-500/20'}`}>
                                {forensicResult.text}
                              </p>
                              {forensicResult.sources.length > 0 && (
                                <div className="pt-6 border-t border-slate-800/50">
                                  <p className="text-cyan-500 font-black mb-4 tracking-[0.2em] uppercase text-xs">Verified Intel Sources</p>
                                  <div className="grid grid-cols-1 gap-3">
                                    {forensicResult.sources.map((s, i) => (
                                      <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all group/src">
                                        <span className="text-emerald-500 mr-3 font-black">✓</span>
                                        <span className="text-slate-400 group-hover/src:text-slate-200 truncate">{s.title || s.uri}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full space-y-6 opacity-20">
                              <p className="text-center font-black tracking-[0.3em] text-sm uppercase">Awaiting Target Input</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                    
                    {/* History Section */}
                    <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-8 shadow-3xl flex flex-col h-full min-h-[500px]">
                      <h2 className="text-xl font-black text-white uppercase tracking-[0.4em] mb-10 flex items-center">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full mr-4 shadow-[0_0_15px_rgba(16,185,129,0.8)]"></span>
                        Scan History
                      </h2>
                      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {forensicHistory.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full space-y-6 opacity-20">
                             <p className="text-center font-black tracking-[0.3em] text-sm uppercase">No Prior Scans</p>
                           </div>
                        ) : (
                          forensicHistory.map(item => (
                            <div key={item.id} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl hover:border-cyan-500/30 transition-colors cursor-pointer" onClick={() => loadHistoryItem(item)}>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-cyan-400 font-mono text-xs font-bold truncate pr-4">{item.query}</h4>
                                <span className="text-slate-500 text-[10px] font-mono whitespace-nowrap">{item.timestamp.toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center space-x-3 mt-3">
                                {item.isDeepScan && <span className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 rounded text-[9px] uppercase tracking-wider">Deep Scan</span>}
                                <span className="text-slate-400 text-[10px] uppercase tracking-wider">{item.result.sources.length} Sources</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeTab === 'refactor' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
                  <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-10 shadow-3xl">
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-8">Refactoring Dashboard</h2>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                        <p className="text-slate-400 text-xs uppercase tracking-widest">Files Refactored</p>
                        <p className="text-4xl font-black text-cyan-400">{metrics.filesRefactored}</p>
                      </div>
                      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                        <p className="text-slate-400 text-xs uppercase tracking-widest">Lines Changed</p>
                        <p className="text-4xl font-black text-cyan-400">{metrics.linesChanged}</p>
                      </div>
                      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                        <p className="text-slate-400 text-xs uppercase tracking-widest">Time Saved (min)</p>
                        <p className="text-4xl font-black text-cyan-400">{metrics.timeSaved}</p>
                      </div>
                    </div>
                  </section>
                  
                  <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-10 shadow-3xl">
                    <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-6">Git Integration</h3>
                    <div className="flex items-center space-x-4">
                      <button onClick={() => fetch('/api/git/connect', {method: 'POST', body: JSON.stringify({repoPath: '.'}), headers: {'Content-Type': 'application/json'}}).then(r => r.json()).then(setGitStatus)} className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs">Connect Git</button>
                      <p className="text-slate-400 text-sm">{gitStatus.connected ? `Connected to ${gitStatus.branch}` : 'Not connected'}</p>
                    </div>
                  </section>

                  <section className="bg-slate-900/60 border border-slate-800 rounded-[40px] p-10 shadow-3xl">
                    <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-6">Custom Rules</h3>
                    <div className="space-y-4">
                      {refactorRules.map((rule, i) => (
                        <div key={i} className="bg-slate-800/40 p-4 rounded-xl flex justify-between items-center">
                          <span className="font-mono text-xs text-cyan-400">{rule.pattern} → {rule.transformation}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>

        {/* Link Terminal */}
        <div className="lg:col-span-4 flex flex-col h-[850px] bg-slate-900/80 border border-slate-800 rounded-[40px] overflow-hidden shadow-3xl backdrop-blur-2xl sticky top-24">
          <div className="bg-slate-800/60 p-6 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="font-black text-white text-[10px] tracking-[0.4em] uppercase italic">Sentient Link-IX</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-8 font-mono text-[11px] scroll-smooth">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-3 duration-500`}>
                <div className={`max-w-[90%] p-6 rounded-[32px] shadow-2xl relative ${
                  m.role === 'user' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-950 border border-slate-800 text-slate-400 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">{m.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-8 border-t border-slate-800 bg-slate-950/60">
            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="OPERATIONAL QUERY..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-[24px] px-6 py-5 text-[11px] text-cyan-400 focus:outline-none font-mono"
              />
              <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white p-5 rounded-[24px] shadow-2xl active:scale-95">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default App;
