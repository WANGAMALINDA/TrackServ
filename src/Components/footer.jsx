import { useState, useEffect } from "react";
import { Mail, MapPin, Phone, ArrowRight } from "lucide-react";
import TermsPdf from "./TrackServ_Terms&Conditions.pdf";

const contactNumber = "0664948899";
const contactHref = `tel:${contactNumber}`;

const footerLinks = [
    {
        title: "Support",
        items: ["Contact Us", "Terms and Conditions"],
    },
];

function Footer() {
    const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    const narrow768 = width < 768;

    return (
        <footer
            className="site-footer"
            style={{
                marginTop: 28,
                background: "linear-gradient(135deg, #0f172a 0%, #14532d 100%)",
                color: "#fff",
                borderRadius: 18,
                overflow: "hidden",
            }}
        >
            <div style={{ padding: narrow768 ? "24px 18px 18px" : "32px 28px 20px" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: narrow768 ? "1fr" : "1.3fr 1fr",
                        gap: 24,
                        alignItems: "start",
                    }}
                >
                    <div>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>TrackServ</p>
                        <p style={{ margin: "10px 0 16px", fontSize: 13, lineHeight: 1.7, color: "#d1fae5", maxWidth: 420 }}>
                            TrackServ helps citizens report issues, follow progress, and stay connected with local community updates.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#e5e7eb" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <MapPin size={16} color="#86efac" />
                                <span>Tshwane, South Africa</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Phone size={16} color="#86efac" />
                                <a href={contactHref} style={{ color: "inherit", textDecoration: "none" }}>
                                    {contactNumber}
                                </a>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Mail size={16} color="#86efac" />
                                <a href={contactHref} style={{ color: "inherit", textDecoration: "none" }}>
                                   info@trackserv.co.za
                                </a>
                            </div>
                        </div>
                    </div>

                    {footerLinks.map((group) => (
                        <div key={group.title}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{group.title}</p>
                            <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                                {group.items.map((item) => (
                                    <li key={item}>
                                        <a
                                            href={item === "Contact Us" ? contactHref : TermsPdf}
                                            target={item === "Terms and Conditions" ? "_blank" : undefined}
                                            rel={item === "Terms and Conditions" ? "noopener noreferrer" : undefined}
                                            style={{
                                                color: "#d1fae5",
                                                textDecoration: "none",
                                                fontSize: 13,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <ArrowRight size={14} />
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        marginTop: 24,
                        paddingTop: 18,
                        borderTop: "1px solid rgba(255,255,255,0.14)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                    }}
                >
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>
                        © 2026 TrackServ. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;