import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import LoginDialog from "./components/LoginDialog";
import Desktop from "./components/Desktop";
import ProfilePage from "./components/ProfilePage";

function Shell() {
    const [user, setUser] = useState(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("gw_user");
        if (saved) {
            try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
        }
        setLoaded(true);
    }, []);

    const logout = () => {
        localStorage.removeItem("gw_user");
        localStorage.removeItem("gw_avatar");
        setUser(null);
    };

    if (!loaded) return null;
    if (!user) return <LoginDialog onJoin={setUser} />;
    return <Desktop user={user} onLogout={logout} />;
}

export default function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <Toaster
                    position="bottom-right"
                    theme="light"
                    toastOptions={{
                        style: {
                            fontFamily: "'VT323', monospace",
                            fontSize: 16,
                            borderRadius: 0,
                            border: "2px solid #000",
                            background: "#c0c0c0",
                            color: "#000",
                            boxShadow:
                                "inset -1px -1px 0 #808080, inset 1px 1px 0 #dfdfdf, 2px 2px 0 #000",
                        },
                    }}
                />
                <Routes>
                    <Route path="/" element={<Shell />} />
                    <Route path="/r/:roomId" element={<Shell />} />
                    <Route path="/u/:nickname" element={<ProfilePage />} />
                    <Route path="/guestbook" element={<Shell />} />
                </Routes>
            </BrowserRouter>
        </div>
    );
}
