"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  ArrowRight,
  Menu,
  X,
  MapPin,
  Users,
  Star,
  Plane,
  Truck,
  Ship,
  Clock,
  Shield,
  TrendingUp,
  Globe,
  Mail,
  Phone,
} from "lucide-react";

// Styles object
const pricingStyles = {
  pricingSection: {
    padding: "80px 16px",
    background:
      "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(65, 29, 123, 0.4))",
    borderTop: "1px solid rgba(139, 92, 246, 0.2)",
    borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
    position: "relative",
    overflow: "hidden",
  },
  pricingHeader: {
    textAlign: "center",
    marginBottom: "64px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  badge: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: "9999px",
    background: "rgba(139, 92, 246, 0.2)",
    border: "1px solid rgba(139, 92, 246, 0.4)",
    margin: "0 auto",
  },
  badgeText: {
    color: "#c084fc",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.05em",
  },
  pricingTitle: {
    fontSize: "clamp(32px, 6vw, 48px)",
    fontWeight: "bold",
    background: "linear-gradient(to right, #a78bfa, #3b82f6)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  pricingSubtitle: {
    fontSize: "18px",
    color: "#9ca3af",
    margin: "0 auto",
    maxWidth: "600px",
  },
  formContainer: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "48px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.4))",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 32px rgba(139, 92, 246, 0.1)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    marginBottom: "24px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  formLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#a78bfa",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  inputField: {
    padding: "14px 16px",
    borderRadius: "10px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    color: "white",
    fontSize: "15px",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
    outline: "none",
  },
  selectField: {
    padding: "14px 16px",
    borderRadius: "10px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    color: "white",
    fontSize: "15px",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
    outline: "none",
    cursor: "pointer",
  },
  selectOption: {
    background: "#1e293b",
    color: "white",
    padding: "10px",
  },
  quickTags: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  tag: {
    padding: "8px 16px",
    borderRadius: "20px",
    background: "rgba(139, 92, 246, 0.2)",
    border: "1px solid rgba(139, 92, 246, 0.4)",
    color: "#c084fc",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  tagActive: {
    background: "linear-gradient(135deg, #a855f7, #3b82f6)",
    color: "white",
    borderColor: "transparent",
  },
  buttonRow: {
    display: "flex",
    gap: "16px",
    marginTop: "32px",
  },
  calculateBtn: {
    flex: 1,
    padding: "14px 32px",
    borderRadius: "10px",
    background: "linear-gradient(to right, #a855f7, #3b82f6)",
    border: "none",
    color: "white",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
  },
  resetBtn: {
    padding: "14px 32px",
    borderRadius: "10px",
    background: "transparent",
    border: "2px solid rgba(139, 92, 246, 0.4)",
    color: "#a78bfa",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 0.3s ease",
  },
  resultBox: {
    marginTop: "32px",
    padding: "24px",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.1))",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    animation: "slideUp 0.5s ease-out",
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "24px",
    marginBottom: "16px",
  },
  resultItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  resultLabel: {
    fontSize: "13px",
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  resultValue: {
    fontSize: "28px",
    fontWeight: "bold",
    background: "linear-gradient(to right, #facc15, #fbbf24)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  priceBreakdown: {
    borderTop: "1px solid rgba(139, 92, 246, 0.2)",
    paddingTop: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownText: {
    color: "#d1d5db",
    fontSize: "14px",
  },
};

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(to bottom right, #0f172a, #411d7b, #0f172a)",
    color: "white",
    overflow: "hidden",
    fontFamily:
      "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  nav: {
    position: "fixed",
    top: 0,
    width: "100%",
    background: "rgba(15, 23, 42, 0.8)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
    zIndex: 50,
    padding: "0 16px",
  },
  navContent: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "20px",
    fontWeight: "bold",
  },
  navLogo: {
    width: "32px",
    height: "32px",
    background: "linear-gradient(to bottom right, #a78bfa, #3b82f6)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
  },
  navLink: {
    cursor: "pointer",
    transition: "color 0.3s ease",
  },
  loginBtn: {
    padding: "8px 24px",
    borderRadius: "8px",
    background: "linear-gradient(to right, #a855f7, #3b82f6)",
    border: "none",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  mobileMenu: {
    display: "none",
  },
  mobileMenuOpen: {
    paddingBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  heroSection: {
    paddingTop: "128px",
    paddingBottom: "80px",
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  heroContent: {
    maxWidth: "896px",
    margin: "0 auto",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    animation: "fadeInUp 0.8s ease-out forwards",
  },
  heroTitle: {
    fontSize: "clamp(32px, 8vw, 80px)",
    fontWeight: "bold",
    lineHeight: "1.2",
  },
  heroSubtitle: {
    fontSize: "clamp(18px, 4vw, 28px)",
    color: "#d1d5db",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "48px",
    maxWidth: "600px",
    margin: "0 auto",
  },
  formRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  inputWrapper: {
    flex: 1,
    position: "relative",
    minWidth: "200px",
  },
  input: {
    width: "100%",
    padding: "12px 16px 12px 40px",
    borderRadius: "8px",
    background: "rgba(30, 41, 59, 0.5)",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    color: "white",
    fontSize: "16px",
    transition: "all 0.3s ease",
    outline: "none",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
  },
  trackBtn: {
    padding: "12px 32px",
    borderRadius: "8px",
    background: "linear-gradient(to right, #facc15, #eab308)",
    border: "none",
    color: "black",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontSize: "16px",
    whiteSpace: "nowrap",
  },
  trackingResult: {
    marginTop: "32px",
    padding: "24px",
    borderRadius: "12px",
    background:
      "linear-gradient(to bottom right, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))",
    border: "1px solid rgba(139, 92, 246, 0.3)",
    animation: "fadeInUp 0.6s ease-out",
  },
  progressBar: {
    width: "100%",
    height: "8px",
    background: "#334155",
    borderRadius: "9999px",
    overflow: "hidden",
    marginTop: "16px",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(to right, #a855f7, #3b82f6)",
    transition: "width 0.5s ease",
  },
  sponsorSection: {
    padding: "48px 16px",
    borderTop: "1px solid rgba(139, 92, 246, 0.2)",
    borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
    background: "rgba(15, 23, 42, 0.5)",
    overflow: "hidden",
  },
  sponsorLabel: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "24px",
    letterSpacing: "0.1em",
  },
  sponsorTrack: {
    display: "flex",
    gap: "32px",
    animation: "slideInfinite 25s linear infinite",
    width: "200%",
  },
  sponsorCard: {
    flexShrink: 0,
    height: "64px",
    padding: "0 32px",
    borderRadius: "8px",
    background:
      "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))",
    border: "1px solid rgba(139, 92, 246, 0.2)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    minWidth: "200px",
  },
  statsSection: {
    padding: "80px 16px",
  },
  statsGrid: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "24px",
  },
  statCard: {
    padding: "24px",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))",
    border: "1px solid rgba(139, 92, 246, 0.2)",
    transition: "all 0.3s ease",
  },
  statIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: "14px",
  },
};

// Animation keyframes
const keyframes = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideInfinite {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes glowPulse {
    0%, 100% {
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 40px rgba(139, 92, 246, 0.6);
    }
  }
    @keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

export default function Home() {
  const navigate = useNavigate();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trackingResult, setTrackingResult] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleTrack = (e) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setTrackingResult({
        number: trackingNumber,
        status: "In Transit",
        from: "New Delhi",
        to: "Mumbai",
        progress: 65,
      });
      setShowTracking(true);
    }
  };

  const sponsors = [
    { name: "TechCorp", logo: "📦" },
    { name: "ShipGlobal", logo: "🌍" },
    { name: "FastTrack", logo: "⚡" },
    { name: "SecureFlow", logo: "🔒" },
    { name: "LogisPro", logo: "📊" },
    { name: "CloudSync", logo: "☁️" },
  ];

  const sponsorLoop = [...sponsors, ...sponsors];

  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.container}>
        {/* Navigation */}
        <nav style={styles.nav}>
          <div style={styles.navContent}>
            <div style={styles.navBrand}>
              <div style={styles.navLogo}>
                <Package size={20} />
              </div>
              <span>RR Enterprise</span>
            </div>

            {/* Desktop Navigation */}
            {!isMobile && (
              <div style={styles.navLinks}>
                <a
                  href="#services"
                  style={styles.navLink}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#a78bfa")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.color = "white")}
                >
                  Services
                </a>
                <a
                  href="#pricing"
                  style={styles.navLink}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#a78bfa")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.color = "white")}
                >
                  Pricing
                </a>
                <a
                  href="#testimonials"
                  style={styles.navLink}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#a78bfa")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.color = "white")}
                >
                  Testimonials
                </a>
                <button
                  style={styles.loginBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  onClick={() => navigate("/login")}
                >
                  Login
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
          </div>

          {/* Mobile Navigation */}
          {isMobile && mobileMenuOpen && (
            <div style={{ ...styles.mobileMenuOpen, padding: "16px" }}>
              <a href="#services" style={{ color: "white", cursor: "pointer" }}>
                Services
              </a>
              <a href="#pricing" style={{ color: "white", cursor: "pointer" }}>
                Pricing
              </a>
              <a
                href="#testimonials"
                style={{ color: "white", cursor: "pointer" }}
              >
                Testimonials
              </a>
              <button 
                style={{ ...styles.loginBtn, width: "100%" }}
                onClick={() => navigate("/login")}
              >
                Login
              </button>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section style={styles.heroSection}>
          <div style={styles.heroContent}>
            <h1 style={styles.heroTitle}>
              Reliable Logistics for Your Business
            </h1>
            <p style={styles.heroSubtitle}>
              Fast, secure, and transparent delivery tracking for all your
              shipments across India.
            </p>

            {/* Tracking Form */}
            <form onSubmit={handleTrack} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.inputWrapper}>
                  <Search style={styles.searchIcon} size={20} />
                  <input
                    type="text"
                    placeholder="Enter tracking number..."
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    style={styles.input}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "rgba(139, 92, 246, 0.6)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "rgba(139, 92, 246, 0.3)")
                    }
                  />
                </div>
                <button
                  type="button"
                  style={styles.trackBtn}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "linear-gradient(to right, #eab308, #ca8a04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "linear-gradient(to right, #facc15, #eab308)")
                  }
                  onClick={() => navigate("/login")}
                >
                  Track
                </button>
              </div>
            </form>

            {/* Tracking Result */}
            {showTracking && trackingResult && (
              <div style={styles.trackingResult}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <span style={{ color: "#d1d5db" }}>
                    Tracking #{trackingResult.number}
                  </span>
                  <span
                    style={{
                      padding: "4px 16px",
                      borderRadius: "9999px",
                      background: "rgba(59, 130, 246, 0.2)",
                      color: "#93c5fd",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    {trackingResult.status}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "16px",
                    fontSize: "18px",
                    marginBottom: "16px",
                  }}
                >
                  <span>{trackingResult.from}</span>
                  <ArrowRight size={20} style={{ color: "#a855f7" }} />
                  <span>{trackingResult.to}</span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${trackingResult.progress}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Animated Sponsor Section */}
        <section style={styles.sponsorSection}>
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              marginBottom: "24px",
            }}
          >
            <p style={styles.sponsorLabel}>TRUSTED BY LEADING COMPANIES</p>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={styles.sponsorTrack}>
              {sponsorLoop.map((sponsor, idx) => (
                <div
                  key={idx}
                  style={styles.sponsorCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.4)";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.2)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <span style={{ fontSize: "32px" }}>{sponsor.logo}</span>
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sponsor.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section style={styles.statsSection}>
          <div style={styles.statsGrid}>
            {[
              {
                icon: Package,
                value: "50K+",
                label: "Delivered",
                gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              },
              {
                icon: MapPin,
                value: "500+",
                label: "Cities",
                gradient: "linear-gradient(135deg, #10b981, #059669)",
              },
              {
                icon: Users,
                value: "10K+",
                label: "Clients",
                gradient: "linear-gradient(135deg, #eab308, #ca8a04)",
              },
              {
                icon: Star,
                value: "4.9",
                label: "Rating",
                gradient: "linear-gradient(135deg, #a855f7, #ec4899)",
              },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.6)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.2)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{ ...styles.statIcon, background: stat.gradient }}
                  >
                    <Icon size={24} />
                  </div>
                  <div style={styles.statValue}>{stat.value}</div>
                  <div style={styles.statLabel}>{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Services Section */}
        <section
          id="services"
          style={{ padding: "80px 16px", background: "rgba(15, 23, 42, 0.5)" }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                marginBottom: "64px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: "9999px",
                  background: "rgba(139, 92, 246, 0.2)",
                  border: "1px solid rgba(139, 92, 246, 0.4)",
                  margin: "0 auto",
                }}
              >
                <span
                  style={{
                    color: "#c084fc",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  LOGISTICS SOLUTIONS
                </span>
              </div>
              <h2
                style={{
                  fontSize: "clamp(32px, 6vw, 48px)",
                  fontWeight: "bold",
                }}
              >
                Our Expertise
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#9ca3af",
                  margin: "0 auto",
                  maxWidth: "600px",
                }}
              >
                Sophisticated transport solutions tailored for your business
                needs.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "32px",
              }}
            >
              {[
                {
                  icon: Plane,
                  title: "Air Freight",
                  desc: "Fastest worldwide delivery for time-sensitive cargo.",
                  features: ["Next-flight out", "Global coverage"],
                  featured: false,
                  gradient:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))",
                },
                {
                  icon: Truck,
                  title: "Road Transport",
                  desc: "Reliable nationwide trucking network for all loads.",
                  features: ["Door-to-door", "Real-time tracking"],
                  featured: true,
                  gradient:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))",
                },
                {
                  icon: Ship,
                  title: "Ocean Cargo",
                  desc: "Cost-effective international shipping solutions.",
                  features: ["FCL & LCL options", "Port-to-port"],
                  featured: false,
                  gradient:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))",
                },
              ].map((service, idx) => {
                const Icon = service.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "32px",
                      borderRadius: "12px",
                      background: service.gradient,
                      border: service.featured
                        ? "2px solid rgba(139, 92, 246, 0.6)"
                        : "1px solid rgba(139, 92, 246, 0.3)",
                      transition: "all 0.3s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-8px)";
                      e.currentTarget.style.boxShadow =
                        "0 20px 40px rgba(139, 92, 246, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {service.featured && (
                      <div
                        style={{
                          position: "absolute",
                          top: "16px",
                          right: "16px",
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          background: "rgba(250, 204, 21, 0.2)",
                          color: "#facc15",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        Featured
                      </div>
                    )}
                    <Icon
                      size={32}
                      style={{ marginBottom: "16px", color: "#a78bfa" }}
                    />
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "12px",
                      }}
                    >
                      {service.title}
                    </h3>
                    <p
                      style={{
                        color: "#d1d5db",
                        marginBottom: "16px",
                        fontSize: "14px",
                      }}
                    >
                      {service.desc}
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {service.features.map((feature, i) => (
                        <li
                          key={i}
                          style={{ fontSize: "14px", color: "#9ca3af" }}
                        >
                          ✓ {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section style={{ padding: "80px 16px" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <h2
                style={{
                  fontSize: "clamp(32px, 6vw, 48px)",
                  fontWeight: "bold",
                  marginBottom: "16px",
                }}
              >
                Why RR Enterprise
              </h2>
              <p style={{ fontSize: "18px", color: "#9ca3af" }}>
                Refined processes that prioritize security and transparency
                above all else.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "32px",
              }}
            >
              {[
                {
                  icon: Clock,
                  title: "Real-time Tracking",
                  desc: "Sophisticated dashboard for precise shipment monitoring.",
                },
                {
                  icon: Shield,
                  title: "Secure Custody",
                  desc: "End-to-end security protocols for high-value cargo.",
                },
                {
                  icon: TrendingUp,
                  title: "Optimized Rates",
                  desc: "Performance-based pricing for long-term partners.",
                },
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "32px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(139, 92, 246, 0.6)";
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(139, 92, 246, 0.2)";
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))";
                    }}
                  >
                    <Icon
                      size={32}
                      style={{ marginBottom: "16px", color: "#a78bfa" }}
                    />
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "12px",
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      style={{ color: "#d1d5db", fontSize: "14px", margin: 0 }}
                    >
                      {feature.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        {/* Pricing Section - Replace the existing one */}
        <section id="pricing" style={pricingStyles.pricingSection}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            {/* Header */}
            <div style={pricingStyles.pricingHeader}>
              <div style={pricingStyles.badge}>
                <span style={pricingStyles.badgeText}>💰 INSTANT PRICING</span>
              </div>
              <h2 style={pricingStyles.pricingTitle}>Get a Quote</h2>
              <p style={pricingStyles.pricingSubtitle}>
                Calculate shipping costs instantly with our transparent pricing
                model
              </p>
            </div>

            {/* Form Container */}
            <div style={pricingStyles.formContainer}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Handle calculation logic here
                }}
              >
                {/* Quick Selection Tags */}
                <div style={{ marginBottom: "32px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#9ca3af",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Quick Select
                  </div>
                  <div style={pricingStyles.quickTags}>
                    {[
                      "Within City",
                      "Same State",
                      "Pan India",
                      "International",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        style={pricingStyles.tag}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(139, 92, 246, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(139, 92, 246, 0.2)";
                        }}
                        onClick={(e) => {
                          // Handle tag selection
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Form Grid */}
                <div style={pricingStyles.formGrid}>
                  {/* Origin */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>
                      📍 From Pincode
                    </label>
                    <input
                      type="text"
                      placeholder="110001"
                      style={pricingStyles.inputField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    />
                  </div>

                  {/* Destination */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>📍 To Pincode</label>
                    <input
                      type="text"
                      placeholder="400001"
                      style={pricingStyles.inputField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    />
                  </div>

                  {/* Weight */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>
                      ⚖️ Weight (kg)
                    </label>
                    <input
                      type="number"
                      placeholder="2.5"
                      style={pricingStyles.inputField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    />
                  </div>

                  {/* Package Type */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>
                      📦 Package Type
                    </label>
                    <select
                      style={pricingStyles.selectField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    >
                      <option style={pricingStyles.selectOption}>Parcel</option>
                      <option style={pricingStyles.selectOption}>
                        Document
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Fragile
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Oversized
                      </option>
                    </select>
                  </div>

                  {/* Delivery Speed */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>
                      ⚡ Delivery Speed
                    </label>
                    <select
                      style={pricingStyles.selectField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    >
                      <option style={pricingStyles.selectOption}>
                        Standard (5-7 days)
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Express (2-3 days)
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Overnight (Next day)
                      </option>
                    </select>
                  </div>

                  {/* Insurance */}
                  <div style={pricingStyles.formGroup}>
                    <label style={pricingStyles.formLabel}>🛡️ Insurance</label>
                    <select
                      style={pricingStyles.selectField}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                        e.target.style.background = "rgba(15, 23, 42, 0.8)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(139, 92, 246, 0.3)";
                        e.target.style.background = "rgba(15, 23, 42, 0.6)";
                      }}
                    >
                      <option style={pricingStyles.selectOption}>
                        No Insurance
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Basic (₹50)
                      </option>
                      <option style={pricingStyles.selectOption}>
                        Premium (₹100)
                      </option>
                    </select>
                  </div>
                </div>

                {/* Buttons */}
                <div style={pricingStyles.buttonRow}>
                  <button
                    type="submit"
                    style={pricingStyles.calculateBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 12px 32px rgba(139, 92, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 24px rgba(139, 92, 246, 0.3)";
                    }}
                  >
                    💰 Calculate Price
                  </button>
                  <button
                    type="button"
                    style={pricingStyles.resetBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(139, 92, 246, 0.7)";
                      e.currentTarget.style.color = "#e9d5ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentButton.style.borderColor =
                        "rgba(139, 92, 246, 0.4)";
                      e.currentTarget.style.color = "#a78bfa";
                    }}
                  >
                    Reset
                  </button>
                </div>

                {/* Sample Result (shown conditionally) */}
                <div style={pricingStyles.resultBox}>
                  <div style={pricingStyles.resultGrid}>
                    <div style={pricingStyles.resultItem}>
                      <span style={pricingStyles.resultLabel}>Base Price</span>
                      <span style={pricingStyles.resultValue}>₹245</span>
                    </div>
                    <div style={pricingStyles.resultItem}>
                      <span style={pricingStyles.resultLabel}>Taxes</span>
                      <span
                        style={{
                          fontSize: "28px",
                          fontWeight: "bold",
                          color: "#d1d5db",
                        }}
                      >
                        ₹44
                      </span>
                    </div>
                    <div style={pricingStyles.resultItem}>
                      <span style={pricingStyles.resultLabel}>Total Price</span>
                      <span style={pricingStyles.resultValue}>₹289</span>
                    </div>
                  </div>
                  <div style={pricingStyles.priceBreakdown}>
                    <span style={pricingStyles.breakdownText}>
                      Estimated delivery: <strong>5-7 business days</strong>
                    </span>
                    <button
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        background:
                          "linear-gradient(to right, #facc15, #eab308)",
                        border: "none",
                        color: "black",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" style={{ padding: "80px 16px" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                marginBottom: "64px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: "9999px",
                  background: "rgba(139, 92, 246, 0.2)",
                  border: "1px solid rgba(139, 92, 246, 0.4)",
                  margin: "0 auto",
                }}
              >
                <span
                  style={{
                    color: "#c084fc",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  TESTIMONIALS
                </span>
              </div>
              <h2
                style={{
                  fontSize: "clamp(32px, 6vw, 48px)",
                  fontWeight: "bold",
                }}
              >
                What Our Customers Say
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#9ca3af",
                  margin: "0 auto",
                  maxWidth: "600px",
                }}
              >
                Trusted by thousands of businesses across India
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "32px",
              }}
            >
              {[
                {
                  name: "Rahul Sharma",
                  role: "E-commerce Owner, Delhi",
                  quote:
                    "RR Enterprise has transformed our logistics. Their tracking system is excellent and deliveries are always on time. Highly recommended!",
                },
                {
                  name: "Priya Mehta",
                  role: "Operations Manager, Mumbai",
                  quote:
                    "Best B2B logistics partner we've worked with. Their API integration was seamless and the support team is incredibly responsive.",
                },
                {
                  name: "Amit Kumar",
                  role: "Retailer, Bangalore",
                  quote:
                    "Reliable service with competitive pricing. We've reduced our logistics costs by 30% since switching to RR Enterprise.",
                },
              ].map((testimonial, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "32px",
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(15, 23, 42, 0.3))",
                    border: "1px solid rgba(139, 92, 246, 0.2)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.4)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(139, 92, 246, 0.2)")
                  }
                >
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={20}
                        style={{ fill: "#facc15", color: "#facc15" }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      color: "#d1d5db",
                      fontStyle: "italic",
                      margin: "0",
                    }}
                  >
                    "{testimonial.quote}"
                  </p>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{testimonial.name}</div>
                    <div style={{ fontSize: "14px", color: "#9ca3af" }}>
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          style={{
            padding: "80px 16px",
            background:
              "linear-gradient(to right, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))",
            borderTop: "1px solid rgba(139, 92, 246, 0.2)",
            borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <div
            style={{
              maxWidth: "896px",
              margin: "0 auto",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <h2
              style={{ fontSize: "clamp(32px, 6vw, 48px)", fontWeight: "bold" }}
            >
              Ship with Excellence.
            </h2>
            <p style={{ fontSize: "18px", color: "#d1d5db" }}>
              Experience the most reliable logistics network for your business
              operations.
            </p>
            <button
              style={{
                padding: "12px 32px",
                borderRadius: "8px",
                background: "linear-gradient(to right, #facc15, #eab308)",
                border: "none",
                color: "black",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.3s ease",
                width: "fit-content",
                margin: "0 auto",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(to right, #eab308, #ca8a04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(to right, #facc15, #eab308)")
              }
            >
              Get Started Today
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            padding: "64px 16px",
            background: "rgba(15, 23, 42, 0.5)",
            borderTop: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "48px",
                marginBottom: "48px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      background: "linear-gradient(135deg, #a78bfa, #3b82f6)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Package size={16} />
                  </div>
                  <span style={{ fontWeight: "bold" }}>RR Logistix</span>
                </div>
                <p style={{ color: "#9ca3af", fontSize: "14px", margin: "0" }}>
                  Redefining reliability in Indian logistics through technology
                  and precision.
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  {[Globe, Mail, Phone].map((Icon, i) => (
                    <a
                      key={i}
                      href="#"
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "rgba(139, 92, 246, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(139, 92, 246, 0.4)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(139, 92, 246, 0.2)")
                      }
                    >
                      <Icon size={20} />
                    </a>
                  ))}
                </div>
              </div>

              {["Platform", "Features"].map((title, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <h4 style={{ fontWeight: "bold", margin: "0" }}>{title}</h4>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: "0",
                      margin: "0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {["Tracking", "Pricing", "Services"].map((item, i) => (
                      <li key={i}>
                        <a
                          href="#"
                          style={{
                            color: "#9ca3af",
                            fontSize: "14px",
                            textDecoration: "none",
                            transition: "color 0.3s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#a78bfa")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#9ca3af")
                          }
                        >
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <h4 style={{ fontWeight: "bold", margin: "0" }}>Office</h4>
                <div style={{ color: "#9ca3af", fontSize: "14px" }}>
                  <div>India Operations Centre</div>
                  <div>Mumbai, Maharashtra</div>
                  <div>+91 98765 43210</div>
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(139, 92, 246, 0.2)",
                paddingTop: "32px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "14px",
              }}
            >
              <p style={{ margin: "0" }}>
                © 2026 RR Enterprise. All rights reserved.
              </p>
            </div>
          </div>
        </footer>

        {/* Floating Button */}
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #a855f7, #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.7,
            transition: "all 0.3s ease",
            animation: "float 3s ease-in-out infinite",
            cursor: "pointer",
            zIndex: 40,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          <Truck size={24} />
        </div>
      </div>
    </>
  );
}
