import React from 'react';
import { AboutAppModal } from './components/AboutAppModal';
import { AppShell } from './components/AppShell';
import { AssistantChatModal } from './components/AssistantChatModal';
import { DebtsAndRemindersModal } from './components/DebtsAndRemindersModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InventoryAlertsModal } from './components/InventoryAlertsModal';
import { InvoiceOcrModal } from './components/InvoiceOcrModal';
import { LicenseModal } from './components/LicenseModal';
import { ToastContainer } from './components/ToastContainer';
import { PosProvider, usePos } from './context/PosContext';
import { CasheaScreen } from './screens/CasheaScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { DeliveryNotesScreen } from './screens/DeliveryNotesScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { HomeModulesScreen } from './screens/HomeModulesScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { InvoicesScreen } from './screens/InvoicesScreen';
import { LoginScreen } from './screens/LoginScreen';
import { PosScreen } from './screens/PosScreen';
import { PosTerminalRecordsScreen } from './screens/PosTerminalRecordsScreen';
import { QuotesScreen } from './screens/QuotesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { UsersScreen } from './screens/UsersScreen';
import { WithholdingsScreen } from './screens/WithholdingsScreen';

const MainRouter: React.FC = () => {
  const { currentUser, activeRoute } = usePos();

  if (!currentUser) {
    return (
      <>
        <LoginScreen />
        <AboutAppModal />
        <ToastContainer />
      </>
    );
  }

  const renderScreen = () => {
    switch (activeRoute) {
      case 'home':
        return <HomeModulesScreen />;
      case 'pos':
        return <PosScreen />;
      case 'quotes':
        return <QuotesScreen />;
      case 'delivery_notes':
        return <DeliveryNotesScreen />;
      case 'invoices':
        return <InvoicesScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'withholdings':
        return <WithholdingsScreen />;
      case 'suppliers':
        return <SuppliersScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'pos_terminals':
        return <PosTerminalRecordsScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'cashea':
        return <CasheaScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'summary':
        return <SummaryScreen />;
      case 'users':
        return <UsersScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeModulesScreen />;
    }
  };

  return (
    <>
      <AppShell>{renderScreen()}</AppShell>
      <AssistantChatModal />
      <InvoiceOcrModal />
      <LicenseModal />
      <AboutAppModal />
      <DebtsAndRemindersModal />
      <InventoryAlertsModal />
      <ToastContainer />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <PosProvider>
        <MainRouter />
      </PosProvider>
    </ErrorBoundary>
  );
};

export default App;
