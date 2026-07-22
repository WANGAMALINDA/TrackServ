import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FilePlus, CheckCircle2, Clock, BadgeCheck, X, Menu } from 'lucide-react';
import Logo from '../Components/Logo';

const mapCenter = [-25.746, 28.188];

const reportLatLng = (report) => [
  mapCenter[0] - (report.y - 240) * 0.00035,
  mapCenter[1] + (report.x - 460) * 0.00035,
];

function buildMarkerIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const Landing = () => {
  const navigate = useNavigate();
  const STORAGE_KEY = 'trackserv_reports_v1';
  const REF_KEY = 'trackserv_ref_seq_v1';

  const statusMeta = {
    new: { label: 'Newly Reported', pillClass: 'status-new', dotClass: 'dot-new', color: '#2563EB' },
    progress: { label: 'In Progress', pillClass: 'status-progress', dotClass: 'dot-progress', color: '#e8a33d' },
    resolved: { label: 'Resolved', pillClass: 'status-resolved', dotClass: 'dot-resolved', color: '#16A34A' }
  };

  const typeIcons = {
    'Pothole': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
    'Water Leak': '<svg viewBox="0 0 24 24"><path d="M12 2s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/></svg>',
    'Streetlight': '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-6 6c0 3 2 4.5 3 6h6c1-1.5 3-3 3-6a6 6 0 0 0-6-6z"/></svg>',
    'Sanitation': '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    'Vandalism': '<svg viewBox="0 0 24 24"><path d="M12 2l2.6 5.6L21 9l-4.8 4.2L17.6 20 12 16.9 6.4 20l1.4-6.8L3 9l6.4-1.4z"/></svg>',
    'Safety': '<svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>'
  };

  const seedReports = [
    { type: 'Pothole', street: 'Burnett Street', ward: 'Ward 2', description: 'Deep pothole causing damage to passing cars.', status: 'resolved', minutesAgo: 60 * 24 * 30, x: 120, y: 340 },
    { type: 'Water Leak', street: 'Beatrix Street', ward: 'Ward 1', description: 'Steady leak flooding the pavement outside no. 45.', status: 'resolved', minutesAgo: 60 * 24 * 21, x: 220, y: 90 },
    { type: 'Streetlight', street: 'Kerk Street', ward: 'Ward 3', description: 'Streetlight has been out for over a week.', status: 'progress', minutesAgo: 60 * 24 * 2, x: 700, y: 120 },
    { type: 'Sanitation', street: 'Church Square', ward: 'Ward 1', description: 'Bin overflowing, attracting pests.', status: 'resolved', minutesAgo: 60 * 24 * 4, x: 260, y: 200 },
    { type: 'Sanitation', street: 'Market Lane', ward: 'Ward 4', description: 'Illegal dumping behind the market building.', status: 'new', minutesAgo: 60 * 5, x: 150, y: 400 },
    { type: 'Vandalism', street: 'Community Hall Rd', ward: 'Ward 2', description: 'Graffiti covering the community hall wall.', status: 'progress', minutesAgo: 60 * 24 * 14, x: 480, y: 300 },
    { type: 'Pothole', street: '5th Avenue', ward: 'Ward 3', description: 'Cluster of potholes near the school crossing.', status: 'new', minutesAgo: 45, x: 780, y: 380 },
    { type: 'Safety', street: 'Riverside Park', ward: 'Ward 4', description: 'Unsafe playground equipment, sharp edges exposed.', status: 'resolved', minutesAgo: 60 * 24 * 33, x: 100, y: 420 },
    { type: 'Streetlight', street: 'Prinsloo Street', ward: 'Ward 2', description: 'Two streetlights flickering intermittently at night.', status: 'progress', minutesAgo: 60 * 8, x: 500, y: 60 },
    { type: 'Water Leak', street: 'Van der Walt Street', ward: 'Ward 3', description: 'Burst pipe under the sidewalk.', status: 'new', minutesAgo: 20, x: 650, y: 250 },
    { type: 'Pothole', street: 'Skinner Street', ward: 'Ward 1', description: 'Large pothole widening after recent rain.', status: 'progress', minutesAgo: 60 * 24 * 6, x: 320, y: 130 },
    { type: 'Sanitation', street: 'Struben Street', ward: 'Ward 4', description: 'Blocked storm drain causing standing water.', status: 'new', minutesAgo: 90, x: 820, y: 150 }
  ];

  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [selectedPopupId, setSelectedPopupId] = useState(null);
  const [trackResults, setTrackResults] = useState([]);
  const [trackSearchValue, setTrackSearchValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [formData, setFormData] = useState({ type: '', street: '', ward: '', description: '' });

  // Responsive breakpoints — same resize-listener approach as Sidebar.jsx / Profile.jsx
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow900 = width < 900;
  const narrow640 = width < 640;


  useEffect(() => {
    const loadReports = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            setReports(parsed);
            return;
          }
        }
      } catch (e) {}

      const now = Date.now();
      const seeded = seedReports.map((r, i) => ({
        id: `seed-${i}`,
        ref: `TS-${1030 + i}`,
        type: r.type,
        street: r.street,
        ward: r.ward,
        description: r.description,
        status: r.status,
        timestamp: now - r.minutesAgo * 60000,
        x: r.x,
        y: r.y,
        eta: estimateCompletion(r.status, now - r.minutesAgo * 60000)
      }));
      saveReports(seeded);
      setReports(seeded);
    };
    loadReports();
  }, []);

  const saveReports = (list) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  };

  const nextRef = () => {
    let seq = parseInt(localStorage.getItem(REF_KEY) || '1042', 10);
    seq += 1;
    localStorage.setItem(REF_KEY, String(seq));
    return `TS-${seq}`;
  };

  const estimateCompletion = (status, timestamp) => {
    if (status === 'resolved') return null;
    const days = status === 'progress' ? 3 : 7;
    return new Date(timestamp + days * 86400000).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  const showToastMessage = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  };

  const relativeTime = (ts) => {
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  };

  const applySearch = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setFilteredReports(null);
    } else {
      setFilteredReports(
        reports.filter(r =>
          r.ref.toLowerCase().includes(q) ||
          r.street.toLowerCase().includes(q) ||
          r.ward.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q)
        )
      );
    }
  };

  const renderTrackResults = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setTrackResults([]);
      return;
    }
    const matches = reports.filter(r =>
      r.ref.toLowerCase().includes(q) ||
      r.street.toLowerCase().includes(q) ||
      r.ward.toLowerCase().includes(q)
    ).slice(0, 6);
    setTrackResults(matches);
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    const { type, street, ward, description } = formData;
    if (!type || !street || !ward || !description) return;

    const now = Date.now();
    const newReport = {
      id: `r-${now}`,
      ref: nextRef(),
      type,
      street,
      ward,
      description,
      status: 'new',
      timestamp: now,
      x: 60 + Math.random() * 780,
      y: 40 + Math.random() * 380,
      eta: estimateCompletion('new', now)
    };
    const updated = [newReport, ...reports];
    setReports(updated);
    saveReports(updated);
    setFilteredReports(null);
    setReportModalOpen(false);
    setFormData({ type: '', street: '', ward: '', description: '' });
    showToastMessage(`Report submitted — your reference is ${newReport.ref}.`);
  };

  const listDisplay = filteredReports || reports;
  const statsPending = reports.filter(r => r.status === 'new').length;
  const statsProgress = reports.filter(r => r.status === 'progress').length;
  const statsResolved = reports.filter(r => r.status === 'resolved').length;

  // ===== STYLES =====
  const styles = {
    page: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      color: '#1F2937',
      backgroundColor: '#F8FAFC',
      margin: 0,
      padding: 0,
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
    },
    container: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: narrow640 ? '0 16px' : '0 28px',
    },
    nav: {
      position: 'sticky',
      top: 0,
      zIndex: 1200,
      background: 'rgba(255,255,255,.9)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid #E5E7EB',
    },
    navInner: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: narrow640 ? '12px 16px' : '14px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: narrow640 ? '12px' : '28px',
    },
    navLogo: {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      fontFamily: 'Fraunces, Georgia, serif',
      fontWeight: 700,
      fontSize: '1.15rem',
      color: '#1e40af',
      flexShrink: 0,
    },
    logoMark: {
      width: '30px',
      height: '30px',
      borderRadius: '9px',
      background: 'linear-gradient(155deg, #2563EB, #16A34A)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '17px',
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      flex: 1,
    },
    navLink: {
      fontSize: '.88rem',
      fontWeight: 600,
      color: '#374151',
      padding: '6px 0',
      borderBottom: '2px solid transparent',
      cursor: 'pointer',
      transition: 'color .15s ease, border-color .15s ease',
    },
    navTools: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
    },
    hero: {
      padding: narrow640 ? '32px 0 28px' : '64px 0 40px',
      background: 'radial-gradient(circle at 15% 20%, #f4f7ff, transparent 55%), radial-gradient(circle at 90% 10%, #e1f5eb, transparent 45%)',
    },
    heroInner: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: narrow640 ? '0 16px' : '0 28px',
      display: 'grid',
      gridTemplateColumns: narrow900 ? '1fr' : '1fr 1fr',
      gap: narrow640 ? '32px' : '48px',
      alignItems: 'center',
    },
    eyebrow: {
      display: 'inline-block',
      fontSize: '.76rem',
      fontWeight: 700,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: '#2563EB',
      marginBottom: '10px',
    },
    heroCopy: {
      maxWidth: narrow900 ? '100%' : '480px',
    },
    h1: {
      fontFamily: 'Fraunces, Georgia, serif',
      fontSize: narrow640 ? '1.9rem' : '2.6rem',
      lineHeight: 1.12,
      margin: '0 0 16px',
      color: '#1F2937',
    },
    heroCopyP: {
      fontSize: '1.02rem',
      lineHeight: 1.6,
      color: '#6B7280',
      maxWidth: '480px',
      margin: '0 0 26px',
    },
    heroActions: {
      display: 'flex',
      gap: '14px',
      flexWrap: 'wrap',
      marginBottom: '28px',
    },
    btn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontWeight: 600,
      borderRadius: '100px',
      border: '1px solid transparent',
      padding: '14px 26px',
      fontSize: '.95rem',
      cursor: 'pointer',
      transition: 'transform .12s ease, box-shadow .15s ease, background .15s ease',
      whiteSpace: 'nowrap',
    },
    btnReport: {
      background: '#2563EB',
      color: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,.06)',
    },
    btnTrack: {
      background: '#16A34A',
      color: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,.06)',
    },
    heroStats: {
      display: 'flex',
      gap: '14px',
      flexWrap: 'wrap',
    },
    heroStat: {
      background: '#ffffff',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      boxShadow: '0 10px 30px -12px rgba(0,0,0,.08)',
      padding: '14px 22px',
      minWidth: '110px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      transition: 'transform .18s ease, box-shadow .18s ease',
    },
    heroStatNum: {
      fontFamily: 'Fraunces, Georgia, serif',
      fontSize: '1.7rem',
      fontWeight: 700,
      lineHeight: 1,
    },
    heroStatLabel: {
      fontSize: '.78rem',
      color: '#6B7280',
      fontWeight: 600,
    },
    heroMapWrap: {
      position: 'relative',
    },
    mapCard: {
      position: 'relative',
      zIndex: 0,
      background: '#F8FAFC',
      borderRadius: '20px',
      boxShadow: '0 24px 60px -20px rgba(0,0,0,.16)',
      padding: '14px',
      border: '1px solid #E5E7EB',
      animation: 'floatIn .7s ease both',
    },
    zoneSvg: {
      position: 'relative',
      zIndex: 0,
      width: '100%',
      height: '300px',
      display: 'block',
      borderRadius: '14px',
      overflow: 'hidden',
    },
    mapChip: {
      position: 'absolute',
      left: '26px',
      bottom: '26px',
      background: '#1F2937',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '9px',
      fontSize: '.78rem',
      boxShadow: '0 10px 30px -12px rgba(0,0,0,.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    section: {
      padding: '70px 0',
    },
    sectionHowBg: {
      background: '#F1F5F9',
    },
    sectionHead: {
      maxWidth: '640px',
      margin: '0 auto 40px',
      textAlign: 'center',
    },
    sectionHeadH2: {
      fontFamily: 'Fraunces, Georgia, serif',
      fontSize: '1.9rem',
      margin: '8px 0 10px',
      color: '#1F2937',
    },
    stepsGrid: {
      display: 'grid',
      gridTemplateColumns: narrow640 ? '1fr' : narrow900 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      gap: '20px',
    },
    stepCard: {
      background: '#ffffff',
      border: '1px solid #E5E7EB',
      borderRadius: '20px',
      padding: '26px 22px',
      textAlign: 'center',
      transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
      cursor: 'pointer',
    },
    stepIcon: {
      width: '52px',
      height: '52px',
      borderRadius: '14px',
      margin: '0 auto 14px',
      background: 'linear-gradient(155deg, #2563EB, #16A34A)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
    },
    stepCardH3: {
      fontSize: '1rem',
      margin: '0 0 8px',
      fontFamily: 'Fraunces, Georgia, serif',
    },
    stepCardP: {
      fontSize: '.85rem',
      color: '#6B7280',
      lineHeight: 1.5,
      margin: 0,
    },
    toast: {
      position: 'fixed',
      left: '50%',
      bottom: '26px',
      transform: showToast ? 'translate(-50%, 0)' : 'translate(-50%, 20px)',
      background: '#1F2937',
      color: '#fff',
      padding: '12px 22px',
      borderRadius: '100px',
      fontSize: '.85rem',
      fontWeight: 600,
      opacity: showToast ? 1 : 0,
      pointerEvents: showToast ? 'auto' : 'none',
      transition: 'opacity .25s ease, transform .25s ease',
      zIndex: 200,
      boxShadow: '0 10px 30px -8px rgba(0,0,0,.4)',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,24,40,.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: reportModalOpen || trackModalOpen ? 1 : 0,
      pointerEvents: reportModalOpen || trackModalOpen ? 'auto' : 'none',
      transition: 'opacity .2s ease',
      zIndex: 150,
      padding: '20px',
    },
    modal: {
      background: '#fff',
      borderRadius: '20px',
      width: '100%',
      maxWidth: '460px',
      maxHeight: '88vh',
      overflowY: 'auto',
      boxShadow: '0 24px 60px -20px rgba(0,0,0,.16)',
      transform: reportModalOpen || trackModalOpen ? 'translateY(0)' : 'translateY(10px)',
      transition: 'transform .2s ease',
    },
    modalHead: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 22px',
      borderBottom: '1px solid #E5E7EB',
    },
    modalHeadH3: {
      margin: 0,
      fontFamily: 'Fraunces, Georgia, serif',
    },
    modalBody: {
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    },
    formRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    formLabel: {
      fontSize: '.82rem',
      fontWeight: 600,
      color: '#374151',
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #E5E7EB',
      borderRadius: '9px',
      fontSize: '.88rem',
      fontFamily: 'inherit',
      background: '#F1F5F9',
      transition: 'border-color .15s ease, background .15s ease',
    },
    formActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '4px',
    },
    iconBtn: {
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      border: '1px solid #E5E7EB',
      background: '#F8FAFC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#374151',
      cursor: 'pointer',
      transition: 'background .15s ease',
      fontSize: '15px',
    },
    recentList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    recentItem: {
      display: 'grid',
      gridTemplateColumns: narrow640 ? '36px 1fr auto' : '44px 1fr auto auto',
      gap: narrow640 ? '10px' : '16px',
      alignItems: 'center',
      background: '#ffffff',
      border: '1px solid #E5E7EB',
      borderRadius: '14px',
      padding: narrow640 ? '10px 12px' : '14px 18px',
      cursor: 'pointer',
      transition: 'box-shadow .15s ease, border-color .15s ease, transform .15s ease',
    },
    recentIcon: {
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    recentTitle: {
      fontWeight: 600,
      fontSize: '.9rem',
      margin: '0 0 3px',
    },
    recentMeta: {
      fontSize: '.78rem',
      color: '#6B7280',
      margin: 0,
    },
    recentDate: {
      fontSize: '.78rem',
      color: '#6B7280',
      whiteSpace: 'nowrap',
    },
    statusPill: {
      fontSize: '.72rem',
      fontWeight: 700,
      padding: '5px 12px',
      borderRadius: '100px',
      whiteSpace: 'nowrap',
    },
    footer: {
      background: '#1F2937',
      color: '#cbd3dc',
      padding: '48px 0 0',
    },
    footerInner: {
      maxWidth: '1180px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '32px',
      padding: '0 28px 32px',
    },
    footerBrand: {
      flex: 1,
    },
    footerBrandP: {
      maxWidth: '280px',
      fontSize: '.85rem',
      color: '#9aa5b1',
      margin: '12px 0 0',
    },
    footerLinks: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    footerLink: {
      fontSize: '.85rem',
      color: '#cbd3dc',
      cursor: 'pointer',
      transition: 'color .15s ease',
    },
    footerBottom: {
      borderTop: '1px solid rgba(255,255,255,.1)',
      padding: '18px 28px',
      textAlign: 'center',
      fontSize: '.78rem',
      color: '#7c8794',
    },
  };
  const PageContainer = ({ style, children }) => <div style={style}>{children}</div>;
const MainContent = ({ style = {}, id, children }) => <main style={style} id={id}>{children}</main>;
const HeroSection = ({ style, children }) => <section style={style}>{children}</section>;
const HeroInner = ({ style, children }) => <div style={style}>{children}</div>;
const HeroCopy = ({ style, children }) => <div style={style}>{children}</div>;
const Eyebrow = ({ style, children }) => <span style={style}>{children}</span>;
const H1 = ({ style, children }) => <h1 style={style}>{children}</h1>;
const HeroCopyP = ({ style, children }) => <p style={style}>{children}</p>;
const HeroActions = ({ style, children }) => <div style={style}>{children}</div>;
const Button = ({ style, children, ...props }) => <button style={style} {...props}>{children}</button>;
const HeroStats = ({ style, children }) => <div style={style}>{children}</div>;
const HeroStat = ({ style, children }) => <div style={style}>{children}</div>;
const HeroStatNum = ({ style, children }) => <div style={style}>{children}</div>;
const HeroStatLabel = ({ style, children }) => <span style={style}>{children}</span>;
const HeroMapWrap = ({ style, children }) => <div style={style}>{children}</div>;
const MapCard = ({ style, children }) => <div style={style}>{children}</div>;
const ZoneSvg = ({ style, ...props }) => <svg style={style} {...props} />;
const MapChip = ({ style, children }) => <div style={style}>{children}</div>;
const Section = ({ style, children }) => <section style={style}>{children}</section>;
const SectionContainer = ({ style, children }) => <div style={style}>{children}</div>;
const SectionHead = ({ style, children }) => <div style={style}>{children}</div>;
const SectionHeadH2 = ({ style, children }) => <h2 style={style}>{children}</h2>;
const StepsGrid = ({ style, children }) => <div style={style}>{children}</div>;
const StepCard = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const StepIcon = ({ style, children }) => <div style={style}>{children}</div>;
const StepCardH3 = ({ style, children }) => <h3 style={style}>{children}</h3>;
const StepCardP = ({ style, children }) => <p style={style}>{children}</p>;
const ReportModalOverlay = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const ReportModal = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const TrackModalOverlay = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const TrackModal = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const ModalHead = ({ style, children }) => <div style={style}>{children}</div>;
const ModalHeadH3 = ({ style, children }) => <h3 style={style}>{children}</h3>;
const CloseButton = ({ style, children, ...props }) => <button style={style} {...props}>{children}</button>;
const ModalBody = ({ style, children }) => <div style={style}>{children}</div>;
const FormRow = ({ style, children }) => <div style={style}>{children}</div>;
const FormLabel = ({ style, children }) => <label style={style}>{children}</label>;
const FormInput = ({ style, ...props }) => <input style={style} {...props} />;
const FormSelect = ({ style, children, ...props }) => <select style={style} {...props}>{children}</select>;
const FormTextarea = ({ style, ...props }) => <textarea style={style} {...props} />;
const FormActions = ({ style, children }) => <div style={style}>{children}</div>;
const CancelButton = ({ style, children, ...props }) => <button style={style} {...props}>{children}</button>;
const SubmitButton = ({ style, children, ...props }) => <button style={style} {...props}>{children}</button>;
const TrackResults = ({ style, children }) => <div style={style}>{children}</div>;
const TrackEmpty = ({ style, children }) => <p style={style}>{children}</p>;
const RecentItem = ({ style, children, ...props }) => <div style={style} {...props}>{children}</div>;
const RecentIcon = ({ style, children }) => <span style={style}>{children}</span>;
const RecentBody = ({ children }) => <div>{children}</div>;
const RecentTitle = ({ style, children }) => <p style={style}>{children}</p>;
const RecentMeta = ({ style, children }) => <p style={style}>{children}</p>;
const RecentDate = ({ style, children }) => <span style={style}>{children}</span>;
const StatusPill = ({ style, children }) => <span style={style}>{children}</span>;
const Toast = ({ style, children }) => <div style={style}>{children}</div>;

  return (
    <PageContainer style={styles.page}>

      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <Logo />
          {!narrow900 && (
            <div style={styles.navLinks}>
              <a href="#top" style={styles.navLink}>Home</a>
              <a href="#how-it-works" style={styles.navLink}>How It Works</a>
            </div>
          )}
          {!narrow900 && (
            <div style={styles.navTools}>
              <Link to="/login" style={{ ...styles.navLink, textDecoration: 'none' }}>
                Login
              </Link>
              <Link
                to="/register"
                style={{ ...styles.btn, ...styles.btnReport, padding: '10px 20px', fontSize: '.85rem', textDecoration: 'none' }}
              >
                Sign Up
              </Link>
            </div>
          )}
          {narrow900 && (
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label="Toggle navigation"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 6, display: 'flex' }}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          )}
        </div>
        {narrow900 && mobileMenuOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px 16px 16px',
              borderTop: '1px solid #E5E7EB',
              background: '#fff',
            }}
          >
            <a href="#top" onClick={() => setMobileMenuOpen(false)} style={{ ...styles.navLink, padding: '10px 0' }}>Home</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={{ ...styles.navLink, padding: '10px 0' }}>How It Works</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ ...styles.navLink, padding: '10px 0', textDecoration: 'none' }}>
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              style={{ ...styles.btn, ...styles.btnReport, padding: '10px 20px', fontSize: '.85rem', textDecoration: 'none', marginTop: 8, textAlign: 'center' }}
            >
              Sign Up
            </Link>
          </div>
        )}
      </nav>


      <MainContent id="top">
        {/* ===== HERO ===== */}
        <HeroSection style={styles.hero}>
          <HeroInner style={styles.heroInner}>
            <HeroCopy style={styles.heroCopy}>
              <Eyebrow style={styles.eyebrow}>Municipal Issue Reporting</Eyebrow>
              <H1 style={styles.h1}>Report municipal issues and track progress online</H1>
              <HeroCopyP style={styles.heroCopyP}>
                A simple platform for reporting water leaks, potholes, streetlights and sanitation concerns — with transparent, real-time updates from your municipality.
              </HeroCopyP>
              <HeroActions style={styles.heroActions}>
                <Button style={{ ...styles.btn, ...styles.btnReport }} onClick={() => navigate('/login')}>
                  Report Issue
                </Button>
                <Button style={{ ...styles.btn, ...styles.btnTrack }} onClick={() => navigate('/login')}>
                  Track Status
                </Button>
              </HeroActions>
              
            </HeroCopy>
            <HeroMapWrap style={styles.heroMapWrap}>
              <MapCard style={styles.mapCard}>
                <div style={styles.zoneSvg}>
                  <MapContainer
                    center={mapCenter}
                    zoom={12}
                    scrollWheelZoom={false}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {listDisplay.slice(0, 20).map((r) => (
                      <Marker
                        key={r.id}
                        position={reportLatLng(r)}
                        icon={buildMarkerIcon(statusMeta[r.status].color)}
                      >
                        <Tooltip direction="top" offset={[0, -10]}>
                          {r.type} — {r.street}
                        </Tooltip>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
                <MapChip style={styles.mapChip}>
                  <strong>Live map view</strong>
                  <span>{Math.min(reports.length, 20)} reports near you</span>
                </MapChip>
              </MapCard>
            </HeroMapWrap>
          </HeroInner>
        </HeroSection>

        {/* ===== HOW IT WORKS ===== */}
        <Section style={{ ...styles.section, ...styles.sectionHowBg }}>
          <SectionContainer style={styles.container}>
            <SectionHead style={styles.sectionHead}>
              <Eyebrow style={styles.eyebrow}>How It Works</Eyebrow>
              <SectionHeadH2 style={styles.sectionHeadH2}>From report to resolution, in four steps</SectionHeadH2>
            </SectionHead>
            <StepsGrid style={styles.stepsGrid}>
              <StepCard style={styles.stepCard}>
                <StepIcon style={styles.stepIcon}><FilePlus size={22} /></StepIcon>
                <StepCardH3 style={styles.stepCardH3}>Report an Issue</StepCardH3>
                <StepCardP style={styles.stepCardP}>Describe the problem, add a location and photos in under two minutes.</StepCardP>
              </StepCard>
              <StepCard style={styles.stepCard}>
                <StepIcon style={styles.stepIcon}><CheckCircle2 size={22} /></StepIcon>
                <StepCardH3 style={styles.stepCardH3}>Municipality Reviews the Report</StepCardH3>
                <StepCardP style={styles.stepCardP}>Your report is verified and assigned to the right department and ward team.</StepCardP>
              </StepCard>
              <StepCard style={styles.stepCard}>
                <StepIcon style={styles.stepIcon}><Clock size={22} /></StepIcon>
                <StepCardH3 style={styles.stepCardH3}>Track Progress Online</StepCardH3>
                <StepCardP style={styles.stepCardP}>Follow live status updates using your reference number, any time.</StepCardP>
              </StepCard>
              <StepCard style={styles.stepCard}>
                <StepIcon style={styles.stepIcon}><BadgeCheck size={22} /></StepIcon>
                <StepCardH3 style={styles.stepCardH3}>Issue Successfully Resolved</StepCardH3>
                <StepCardP style={styles.stepCardP}>Get notified the moment your report is closed out and fixed.</StepCardP>
              </StepCard>
            </StepsGrid>
          </SectionContainer>
        </Section>
      </MainContent>

      {/* ===== REPORT MODAL ===== */}
      <ReportModalOverlay
        style={{ ...styles.modalOverlay, opacity: reportModalOpen ? 1 : 0, pointerEvents: reportModalOpen ? 'auto' : 'none' }}
        onClick={() => setReportModalOpen(false)}
      >
        <ReportModal style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <ModalHead style={styles.modalHead}>
            <ModalHeadH3 style={styles.modalHeadH3}>Report an Issue</ModalHeadH3>
            <CloseButton style={styles.iconBtn} onClick={() => setReportModalOpen(false)}><X size={18} /></CloseButton>
          </ModalHead>
          <ModalBody style={styles.modalBody}>
            <FormRow style={styles.formRow}>
              <FormLabel style={styles.formLabel}>Issue Type</FormLabel>
              <FormSelect
                style={styles.formInput}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="">Select an issue type</option>
                <option value="Pothole">Pothole</option>
                <option value="Water Leak">Water Leak</option>
                <option value="Streetlight">Streetlight</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Vandalism">Vandalism</option>
                <option value="Safety">Safety</option>
              </FormSelect>
            </FormRow>
            <FormRow style={styles.formRow}>
              <FormLabel style={styles.formLabel}>Street Name</FormLabel>
              <FormInput
                style={styles.formInput}
                type="text"
                placeholder="e.g., Main Street"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              />
            </FormRow>
            <FormRow style={styles.formRow}>
              <FormLabel style={styles.formLabel}>Ward</FormLabel>
              <FormSelect
                style={styles.formInput}
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
              >
                <option value="">Select a ward</option>
                <option value="Ward 1">Ward 1</option>
                <option value="Ward 2">Ward 2</option>
                <option value="Ward 3">Ward 3</option>
                <option value="Ward 4">Ward 4</option>
              </FormSelect>
            </FormRow>
            <FormRow style={styles.formRow}>
              <FormLabel style={styles.formLabel}>Description</FormLabel>
              <FormTextarea
                style={{ ...styles.formInput, minHeight: '100px', fontFamily: 'inherit' }}
                placeholder="Describe the issue in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </FormRow>
            <FormActions style={styles.formActions}>
              <CancelButton style={{ ...styles.btn, background: '#f1f5f9', color: '#374151', fontSize: '.88rem', padding: '10px 18px' }} onClick={() => setReportModalOpen(false)}>
                Cancel
              </CancelButton>
              <SubmitButton style={{ ...styles.btn, ...styles.btnReport, fontSize: '.88rem', padding: '10px 18px' }} onClick={handleReportSubmit}>
                Submit Report
              </SubmitButton>
            </FormActions>
          </ModalBody>
        </ReportModal>
      </ReportModalOverlay>

      {/* ===== TRACK MODAL ===== */}
      <TrackModalOverlay
        style={{ ...styles.modalOverlay, opacity: trackModalOpen ? 1 : 0, pointerEvents: trackModalOpen ? 'auto' : 'none' }}
        onClick={() => setTrackModalOpen(false)}
      >
        <TrackModal style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <ModalHead style={styles.modalHead}>
            <ModalHeadH3 style={styles.modalHeadH3}>Track Your Report</ModalHeadH3>
            <CloseButton style={styles.iconBtn} onClick={() => setTrackModalOpen(false)}><X size={18} /></CloseButton>
          </ModalHead>
          <ModalBody style={styles.modalBody}>
            <FormRow style={styles.formRow}>
              <FormInput
                style={styles.formInput}
                type="text"
                placeholder="Enter reference number or street name..."
                value={trackSearchValue}
                onChange={(e) => {
                  setTrackSearchValue(e.target.value);
                  renderTrackResults(e.target.value);
                }}
                autoFocus
              />
            </FormRow>
            <TrackResults style={{ ...styles.recentList, maxHeight: '280px', overflowY: 'auto' }}>
              {trackResults.length > 0 ? (
                trackResults.map(r => {
                  const meta = statusMeta[r.status];
                  return (
                    <RecentItem
                      key={r.id}
                      style={styles.recentItem}
                      onClick={() => {
                        setTrackModalOpen(false);
                        setSelectedPopupId(r.id);
                      }}
                    >
                      <RecentIcon style={{ ...styles.recentIcon, background: r.status === 'new' ? '#e8edfc' : r.status === 'progress' ? '#fdf1de' : '#e1f5eb', color: statusMeta[r.status].color }}>
                        {r.type[0]}
                      </RecentIcon>
                      <RecentBody>
                        <RecentTitle style={styles.recentTitle}>{r.type} — {r.street}</RecentTitle>
                        <RecentMeta style={styles.recentMeta}>{r.ward} · Ref {r.ref}</RecentMeta>
                      </RecentBody>
                      {!narrow640 && <RecentDate style={styles.recentDate}>{relativeTime(r.timestamp)}</RecentDate>}
                      <StatusPill style={{ ...styles.statusPill, background: r.status === 'new' ? '#e8edfc' : r.status === 'progress' ? '#fdf1de' : '#e1f5eb', color: statusMeta[r.status].color }}>
                        {meta.label}
                      </StatusPill>
                    </RecentItem>
                  );
                })
              ) : trackSearchValue ? (
                <TrackEmpty style={{ color: '#6B7280', fontSize: '.85rem', textAlign: 'center', padding: '16px 0' }}>
                  No reports match "{trackSearchValue}".
                </TrackEmpty>
              ) : null}
            </TrackResults>
          </ModalBody>
        </TrackModal>
      </TrackModalOverlay>

      {/* ===== TOAST ===== */}
      <Toast style={styles.toast}>{toastMessage}</Toast>
    </PageContainer>
  );
};

// ===== STYLED COMPONENTS =====


export default Landing;