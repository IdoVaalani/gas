import Customers from './pages/Customers';
import Technicians from './pages/Technicians';
import Quotes from './pages/Quotes';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import SystemBackup from './pages/SystemBackup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "Technicians": Technicians,
    "Quotes": Quotes,
    "Invoices": Invoices,
    "Reports": Reports,
    "Dashboard": Dashboard,
    "Items": Items,
    "SystemBackup": SystemBackup,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};