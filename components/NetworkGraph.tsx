import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { ArchitectureNode, ArchitectureLink } from '../types'

interface NetworkGraphProps {
  nodes: ArchitectureNode[]
  links: ArchitectureLink[]
}

/* -------------------------------- CONFIG -------------------------------- */

const STORAGE_KEY = "sentient-x-graph-positions-v2"

const GRAPH_CONFIG = {
  linkDistance: 180,
  chargeStrength: -1000,
  collisionRadius: 70,
  nodeRadius: 14,
  hoverRadius: 18
}

/* -------------------------------- HELPERS -------------------------------- */

function loadSavedPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePositions(nodes: ArchitectureNode[]) {
  const positions = nodes.reduce((acc: any, n: any) => {
    acc[n.id] = { fx: n.fx ?? null, fy: n.fy ?? null }
    return acc
  }, {})
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

function getGroupColor(group: number) {
  switch (group) {
    case 1: return "#06b6d4"
    case 2: return "#10b981"
    case 3: return "#f43f5e"
    default: return "#64748b"
  }
}

function getGroupName(group: number) {
  switch (group) {
    case 1: return "Neural Integration Enclave"
    case 2: return "Kinetic Autonomous Enclave"
    case 3: return "Intelligence Oversight Enclave"
    default: return "Secondary System Node"
  }
}

/* ------------------------------------------------------------------------- */

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, links }) => {

  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<SVGGElement | null>(null)

  const simulationRef = useRef<d3.Simulation<ArchitectureNode, undefined> | null>(null)

  const [hoveredNode, setHoveredNode] = useState<ArchitectureNode | null>(null)

  /* ----------------------------- NODE INIT ----------------------------- */

  const preparedNodes = useMemo(() => {
    const saved = loadSavedPositions()

    return nodes.map(n => {
      const pos = saved[n.id]
      return {
        ...n,
        fx: pos?.fx ?? null,
        fy: pos?.fy ?? null
      }
    })
  }, [nodes])

  /* ----------------------------- GRAPH INIT ---------------------------- */

  useEffect(() => {

    if (!svgRef.current) return
    if (preparedNodes.length === 0) return

    const svg = d3.select(svgRef.current)

    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    /* ----- style defs ----- */

    svg.append("defs")
      .append("style")
      .text(`
        @keyframes dash { to { stroke-dashoffset:-20 } }
        .link-flow { animation: dash 1.5s linear infinite }
      `)

    /* ----- zoom container ----- */

    const root = svg.append("g")
    containerRef.current = root.node()

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 3])
        .on("zoom", (event) => {
          root.attr("transform", event.transform)
        })
    )

    /* ----------------------------- SIMULATION ----------------------------- */

    const simulation = d3.forceSimulation(preparedNodes)
      .force(
        "link",
        d3.forceLink<ArchitectureNode, ArchitectureLink>(links)
          .id(d => d.id)
          .distance(GRAPH_CONFIG.linkDistance)
      )
      .force("charge", d3.forceManyBody().strength(GRAPH_CONFIG.chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(GRAPH_CONFIG.collisionRadius))

    simulationRef.current = simulation

    /* ----------------------------- LINKS ----------------------------- */

    const link = root.append("g")
      .attr("stroke", "#64748b")
      .attr("stroke-opacity", 0.3)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link-flow")
      .attr("stroke-width", d => Math.sqrt(d.value) * 2.5)
      .attr("stroke-dasharray", "5,5")

    /* ----------------------------- NODES ----------------------------- */

    const node = root.append("g")
      .selectAll("circle")
      .data(preparedNodes)
      .join("circle")
      .attr("r", GRAPH_CONFIG.nodeRadius)
      .attr("fill", d => getGroupColor(d.group))
      .attr("stroke", "#020617")
      .attr("stroke-width", 3)
      .style("cursor", "crosshair")
      .on("mouseover", (event, d) => {
        setHoveredNode(d)

        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", GRAPH_CONFIG.hoverRadius)
          .attr("stroke-width", 5)
      })
      .on("mouseout", (event) => {
        setHoveredNode(null)

        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", GRAPH_CONFIG.nodeRadius)
          .attr("stroke-width", 3)
      })
      .call(
        d3.drag<SVGCircleElement, ArchitectureNode>()
          .on("start", (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            event.subject.fx = event.subject.x
            event.subject.fy = event.subject.y
          })
          .on("drag", (event) => {
            event.subject.fx = event.x
            event.subject.fy = event.y
          })
          .on("end", (event) => {
            if (!event.active) simulation.alphaTarget(0)
            savePositions(preparedNodes)
          })
      )

    /* ----------------------------- LABELS ----------------------------- */

    const labels = root.append("g")
      .selectAll("text")
      .data(preparedNodes)
      .join("text")
      .text(d => d.label)
      .attr("font-size", "9px")
      .attr("dx", 22)
      .attr("dy", 4)
      .attr("fill", "#94a3b8")
      .style("font-family", "monospace")
      .style("font-weight", "bold")
      .style("pointer-events", "none")

    /* ----------------------------- TICK ----------------------------- */

    simulation.on("tick", () => {

      link
        .attr("x1", d => (d.source as ArchitectureNode).x!)
        .attr("y1", d => (d.source as ArchitectureNode).y!)
        .attr("x2", d => (d.target as ArchitectureNode).x!)
        .attr("y2", d => (d.target as ArchitectureNode).y!)

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!)

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y!)
    })

    return () => simulation.stop()

  }, [preparedNodes, links])

  /* ----------------------------- RESIZE SUPPORT ----------------------------- */

  useEffect(() => {

    if (!svgRef.current) return

    const observer = new ResizeObserver(() => {
      if (!simulationRef.current) return

      const width = svgRef.current!.clientWidth
      const height = svgRef.current!.clientHeight

      simulationRef.current.force(
        "center",
        d3.forceCenter(width / 2, height / 2)
      )

      simulationRef.current.alpha(0.3).restart()
    })

    observer.observe(svgRef.current)

    return () => observer.disconnect()

  }, [])

  /* ----------------------------- RESET GRAPH ----------------------------- */

  const resetLayout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }, [])

  /* --------------------------------------------------------------------- */

  return (
    <div className="w-full h-full relative group/graph">

      <svg ref={svgRef} className="w-full h-full" />

      {hoveredNode && (
        <div className="absolute top-8 right-8 w-80 bg-slate-900/90 border border-cyan-500/30 p-8 rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl pointer-events-none z-[300]">

          <div className="flex items-center justify-between mb-6">
            <h4 className="font-black text-white text-base uppercase italic">
              {hoveredNode.label}
            </h4>

            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: getGroupColor(hoveredNode.group) }}
            />
          </div>

          <div className="space-y-6">

            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">
                Group Identification
              </p>
              <p className="text-xs text-slate-200 font-mono font-bold uppercase">
                {getGroupName(hoveredNode.group)}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">
                Core Specification
              </p>
              <p className="text-xs text-slate-400 italic border-l-2 border-slate-800 pl-4">
                {hoveredNode.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/50 flex justify-between">

              <div>
                <span className="text-[9px] font-mono text-slate-600 uppercase">
                  System ID
                </span>
                <div className="text-[10px] font-mono text-cyan-400">
                  {hoveredNode.id}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-mono text-slate-600 uppercase">
                  Integrity
                </span>
                <div className="text-[10px] font-mono text-emerald-400">
                  NOMINAL
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8">
        <button
          onClick={resetLayout}
          className="bg-slate-900/50 hover:bg-slate-900 text-[8px] font-black text-slate-500 hover:text-cyan-400 px-4 py-2 rounded-xl border border-slate-800/50 hover:border-cyan-500/20 transition-all uppercase tracking-[0.3em]"
        >
          Re-Initialize Mapping
        </button>
      </div>

    </div>
  )
}

export default NetworkGraph
