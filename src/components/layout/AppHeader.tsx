import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

export function AppHeader() {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-center transition-all duration-300 md:left-[var(--sidebar-width,256px)]">
      <img
        src={logoLight}
        alt="Wisy English School"
        className="h-10 object-contain dark:hidden"
      />
      <img
        src={logoDark}
        alt="Wisy English School"
        className="h-10 object-contain hidden dark:block"
      />
    </header>
  );
}
