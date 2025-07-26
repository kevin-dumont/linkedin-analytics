import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, LogOut, Loader2, CheckCircle } from "lucide-react";
import "./style.css";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
);

function IndexPopup() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    checkUser();
    
    // Restaurer l'état si un magic link a été envoyé
    const savedEmail = localStorage.getItem("pendingMagicLink");
    if (savedEmail) {
      setEmail(savedEmail);
      setMagicLinkSent(true);
    }
  }, []);

  // Ajouter fonction pour vérifier le code OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) throw error;

      setUser(data.user);
      setMagicLinkSent(false);
      setOtpCode("");
      localStorage.removeItem("pendingMagicLink");
      setMessage("Connexion réussie!");
    } catch (error: any) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Ne PAS créer de nouveaux utilisateurs automatiquement
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      localStorage.setItem("pendingMagicLink", email);
      setMessage("Lien de connexion envoyé! Vérifiez votre email.");
    } catch (error: any) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setMessage("Déconnexion réussie");
      setEmail("");
      setMagicLinkSent(false);
      localStorage.removeItem("pendingMagicLink");
    } catch (error: any) {
      setMessage(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-[400px] p-4">
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-[400px] p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#0077B5]">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
            </svg>
            LinkedIn Scraper
          </CardTitle>
          <CardDescription>
            Collectez automatiquement vos posts LinkedIn
          </CardDescription>
        </CardHeader>

        <CardContent>
          {user ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">Connecté en tant que:</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">Extension active</p>
                </div>
                <p className="mt-1 text-xs text-green-700">
                  Vos posts sont collectés automatiquement lors de votre
                  navigation sur LinkedIn
                </p>
              </div>
            </div>
          ) : (
            <div>
              {!magicLinkSent ? (
                <form onSubmit={handleSendMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Utilisez un email déjà enregistré dans Supabase
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Recevoir un lien de connexion
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <Mail className="mx-auto h-8 w-8 text-blue-600" />
                    <p className="mt-2 text-sm font-medium">
                      Code envoyé à {email}
                    </p>
                  </div>
                  
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="otp" className="text-sm font-medium">
                        Code de vérification
                      </label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        required
                        maxLength={6}
                        className="text-center text-lg tracking-widest"
                      />
                      <p className="text-xs text-muted-foreground">
                        Entrez le code à 6 chiffres reçu par email
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Vérification...
                        </>
                      ) : (
                        "Vérifier le code"
                      )}
                    </Button>
                  </form>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMagicLinkSent(false);
                        setEmail("");
                        setMessage("");
                        setOtpCode("");
                        localStorage.removeItem("pendingMagicLink");
                      }}
                      className="flex-1"
                      size="sm"
                    >
                      Changer d'email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSendMagicLink}
                      className="flex-1"
                      size="sm"
                      disabled={loading}
                    >
                      Renvoyer le code
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                message.includes("Erreur")
                  ? "bg-red-50 text-red-800"
                  : "bg-green-50 text-green-800"
              }`}
            >
              {message}
            </div>
          )}
        </CardContent>

        {user && (
          <CardFooter>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Se déconnecter
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default IndexPopup;