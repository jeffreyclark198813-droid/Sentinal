
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ArchitectureNode, ArchitectureLink } from '../types';

interface NetworkGraphProps {
  nodes: ArchitectureNode[];
  links: ArchitectureLink[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<ArchitectureNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const savedPositions = localStorage.getItem('sentient-x-graph-positions');
    const positionsMap = savedPositions ? JSON.parse(savedPositions) : {};

    const nodesWithPositions = nodes.map(node => {
      const saved = positionsMap[node.id];
      return {
        ...node,
        fx: saved ? saved.fx : null,
        fy: saved ? saved.fy : null
      };
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Subtle data flow animation via CSS
    svg.append("defs").append("style").text(`
      @keyframes dash {
        to {
          stroke-dashoffset: -20;
        }
      }
      .link-flow {
        animation: dash 1.5s linear infinite;
      }
    `);

    const container = svg.append("g");

    const simulation = d3.forceSimulation<ArchitectureNode>(nodesWithPositions)
      .force("link", d3.forceLink<ArchitectureNode, ArchitectureLink>(links).id(d => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-1000))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(70));

    // Semi-transparent gray links with animation
    const link = container.append("g")
      .attr("stroke", "#64748b")
      .attr("stroke-opacity", 0.3)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link-flow")
      .attr("stroke-width", d => Math.sqrt(d.value) * 2.5)
      .attr("stroke-dasharray", "5,5");

    const node = container.append("g")
      .selectAll("circle")
      .data(nodesWithPositions)
      .join("circle")
      .attr("r", 14)
      .attr("class", "cursor-crosshair transition-all duration-300")
      .attr("fill", d => d.group === 1 ? "#06b6d4" : d.group === 2 ? "#10b981" : "#f43f5e")
      .attr("stroke", "#020617")
      .attr("stroke-width", 3)
      .attr("filter", d => `drop-shadow(0 0 10px ${d.group === 1 ? 'rgba(6,182,212,0.4)' : d.group === 2 ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'})`)
      .on("mouseover", (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget).transition().duration(200).attr("r", 18).attr("stroke-width", 5);
      })
      .on("mouseout", (event) => {
        setHoveredNode(null);
        d3.select(event.currentTarget).transition().duration(200).attr("r", 14).attr("stroke-width", 3);
      })
      .call(d3.drag<SVGCircleElement, ArchitectureNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    const labels = container.append("g")
      .selectAll("text")
      .data(nodesWithPositions)
      .join("text")
      .text(d => d.label)
      .attr("font-size", "9px")
      .attr("class", "font-mono font-bold pointer-events-none uppercase tracking-widest")
      .attr("fill", "#94a3b8")
      .attr("dx", 22)
      .attr("dy", 4);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("cx", d => (d as any).x)
        .attr("cy", d => (d as any).y);

      labels
        .attr("x", d => (d as any).x)
        .attr("y", d => (d as any).y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      const currentPositions = nodesWithPositions.reduce((acc, n: any) => {
        acc[n.id] = { fx: n.fx, fy: n.fy };
        return acc;
      }, {} as any);
      localStorage.setItem('sentient-x-graph-positions', JSON.stringify(currentPositions));
    }

    return () => { simulation.stop(); };
  }, [nodes, links]);

  // Helper to get group description
  const getGroupName = (group: number) => {
    switch(group) {
      case 1: return "Neural Integration Enclave";
      case 2: return "Kinetic Autonomous Enclave";
      case 3: return "Intelligence Oversight Enclave";
      default: return "Secondary System Node";
    }
  };

  return (
    <div className="w-full h-full relative group/graph">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Absolute Conditional Tooltip Panel */}
      {hoveredNode && (
        <div className="absolute top-8 right-8 w-80 bg-slate-900/90 border border-cyan-500/30 p-8 rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl pointer-events-none z-[300] animate-in fade-in slide-in-from-right-10 duration-500 ease-out">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-white text-base uppercase tracking-tighter italic border-b-2 border-cyan-500/50 pb-1">{hoveredNode.label}</h4>
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-pulse ${hoveredNode.group === 1 ? 'bg-cyan-500' : hoveredNode.group === 2 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-slate-500 font-mono font-black uppercase mb-2 tracking-[0.2em]">Group Identification</p>
              <p className="text-xs text-slate-200 font-mono font-bold uppercase tracking-tight">
                {getGroupName(hoveredNode.group)}
              </p>
            </div>
            
            <div>
              <p className="text-[10px] text-slate-500 font-mono font-black uppercase mb-2 tracking-[0.2em]">Core Specification</p>
              <p className="text-xs text-slate-400 leading-relaxed font-light italic border-l-2 border-slate-800 pl-4">
                {hoveredNode.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-slate-600 uppercase">System ID</span>
                <span className="text-[10px] font-mono text-cyan-500/80 font-bold">{hoveredNode.id}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono text-slate-600 uppercase">Integrity</span>
                <span className="text-[10px] font-mono text-emerald-500/80 font-bold tracking-widest">NOMINAL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Layout Reset */}
      <div className="absolute bottom-8 left-8">
        <button 
          onClick={() => { localStorage.removeItem('sentient-x-graph-positions'); window.location.reload(); }}
          className="bg-slate-900/50 hover:bg-slate-900 text-[8px] font-black text-slate-500 hover:text-cyan-400 px-4 py-2 rounded-xl border border-slate-800/50 hover:border-cyan-500/20 transition-all uppercase tracking-[0.3em] backdrop-blur-md"
        >
          Re-Initialize Mapping
        </button>
      </div>
    </div>
  );
};

export default NetworkGraph;
