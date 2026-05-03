import logo from "../assets/images/logo.png";

interface LoadingPageProps {
  message?: string;
}

const LoadingPage = ({ message = "Verificando sesión..." }: LoadingPageProps) => {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center gap-8 bg-background overflow-hidden">

      {/* Logo + name — slides in from right */}
      <div className="relative flex flex-col items-center gap-5 animate-in fade-in slide-in-from-right-8 duration-700 fill-mode-both">
        <img src={logo} alt="Osefi srl" className="logo-glow h-24 w-24 object-contain" />
        <div className="text-center space-y-1">
          <h1 className="shimmer-text text-4xl font-bold tracking-tight">Osefi srl</h1>
          <p className="text-sm text-muted-foreground">Sistema de gestión</p>
        </div>
      </div>

      {/* Sweep bar right to left */}
      <div className="w-52 h-px bg-border rounded-full overflow-hidden">
        <div
          className="h-full w-2/5 rounded-full bg-primary"
          style={{ animation: "sweep-rtl 1.5s linear infinite" }}
        />
      </div>

      {/* Message */}
      {message && (
        <p
          className="text-xs text-muted-foreground/60 animate-in fade-in duration-700 fill-mode-both"
          style={{ animationDelay: "400ms" }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingPage;
