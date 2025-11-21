import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Users, 
  FileText, 
  LogOut,
  Menu,
  Shield,
  Settings,
  User,
  MessageSquare
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { signOut } = useAuth();
  const { role, isAdmin } = useUserRole();
  const { appName, appLogoUrl } = useAppSettings();
  const location = useLocation();

  const navigation = [
    { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, show: true },
    { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, show: true },
    { name: "Communauté", href: "/communaute", icon: MessageSquare, show: true },
    { name: "Mon Profil", href: "/profil", icon: User, show: true },
    { name: "Membres", href: "/membres", icon: Users, show: isAdmin },
    { name: "Rapports", href: "/rapports", icon: FileText, show: isAdmin },
    { name: "Paramétrage", href: "/parametrage", icon: Settings, show: isAdmin },
  ];

  const isActive = (path: string) => location.pathname === path;

  const NavLinks = () => (
    <>
      {navigation.filter(item => item.show).map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow bg-card border-r border-border">
          <div className="flex items-center gap-2 px-6 py-6 border-b border-border">
            {appLogoUrl ? (
              <Avatar className="w-10 h-10 rounded-lg">
                <AvatarImage src={appLogoUrl} alt={appName} className="object-contain" />
              </Avatar>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{appName}</h1>
              <p className="text-xs text-muted-foreground capitalize">{role || "membre"}</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <NavLinks />
          </nav>
          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {appLogoUrl ? (
              <Avatar className="w-8 h-8 rounded-lg">
                <AvatarImage src={appLogoUrl} alt={appName} className="object-contain" />
              </Avatar>
            ) : (
              <Shield className="w-6 h-6 text-primary" />
            )}
            <h1 className="text-lg font-bold">{appName}</h1>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="px-6 py-6 border-b border-border">
                  <p className="text-sm font-medium">Rôle: <span className="capitalize">{role || "membre"}</span></p>
                </div>
                <nav className="flex-1 space-y-1 px-3 py-4">
                  <NavLinks />
                </nav>
                <div className="p-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => signOut()}
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="md:pl-64 pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
