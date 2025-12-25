
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Calendar, DollarSign, Users, ClipboardList, FileSpreadsheet, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState("all");
  const [showMonthlyRevenue, setShowMonthlyRevenue] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const { data: workOrders } = useQuery({
    queryKey: ['הזמנת_עבודה'],
    queryFn: () => base44.entities.הזמנת_עבודה.list('-created_date'),
    initialData: [],
  });

  const { data: technicians } = useQuery({
    queryKey: ['טכנאי'],
    queryFn: () => base44.entities.טכנאי.list(),
    initialData: [],
  });

  const { data: sites } = useQuery({
    queryKey: ['אתר'],
    queryFn: () => base44.entities.אתר.list(),
    initialData: [],
  });

  const { data: customers } = useQuery({
    queryKey: ['לקוח'],
    queryFn: () => base44.entities.לקוח.list(),
    initialData: [],
  });

  const { data: invoices } = useQuery({
    queryKey: ['חשבונית'],
    queryFn: () => base44.entities.חשבונית.list('-created_date'),
    initialData: [],
  });

  const { data: quotes } = useQuery({
    queryKey: ['הצעת_מחיר'],
    queryFn: () => base44.entities.הצעת_מחיר.list('-created_date'),
    initialData: [],
  });

  const { data: payments } = useQuery({
    queryKey: ['תשלום_חשבונית'],
    queryFn: () => base44.entities.תשלום_חשבונית.list('-תאריך_תשלום'),
    initialData: [],
  });

  // יצירת רשימת 12 חודשים אחרונים
  const getMonthOptions = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7); // YYYY-MM
      const label = date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    return months;
  };

  const monthOptions = getMonthOptions();

  // פילטר לפי טווח זמן או חודש ספציפי
  const filterByTimeRange = (items, dateField) => {
    if (timeRange === "all") return items;
    
    if (timeRange === "specific-month") {
      return items.filter(item => {
        if (!item[dateField]) return false; // Ensure dateField exists
        const itemDate = new Date(item[dateField]);
        const itemMonth = itemDate.toISOString().slice(0, 7); // Get YYYY-MM
        return itemMonth === selectedMonth;
      });
    }
    
    const now = new Date();
    const cutoffDate = new Date();
    
    if (timeRange === "month") {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (timeRange === "week") {
      cutoffDate.setDate(now.getDate() - 7);
    }
    
    return items.filter(item => {
      if (!item[dateField]) return false; // Ensure dateField exists
      const itemDate = new Date(item[dateField]);
      return itemDate >= cutoffDate;
    });
  };

  // חישוב הכנסות לפי חודש - This is for the trend graph and should not be filtered by the timeRange state
  const getMonthlyRevenue = () => {
    const monthlyData = {};
    
    // סינון לחשבוניות ששולמו בלבד
    const paidInvoicesAll = invoices.filter(inv => inv.סטטוס === 'שולמה');
    
    paidInvoicesAll.forEach(invoice => {
      const date = new Date(invoice.תאריך);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthName,
          revenue: 0,
          count: 0,
          monthKey: monthKey
        };
      }
      
      monthlyData[monthKey].revenue += invoice.סכום_כולל || 0;
      monthlyData[monthKey].count += 1;
    });
    
    // המרה למערך וממיון לפי תאריך
    return Object.values(monthlyData)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-12); // 12 חודשים אחרונים
  };

  const monthlyRevenueData = getMonthlyRevenue();

  // סטטיסטיקות כלליות (these are typically for all time or are filtered separately)
  const activeCustomers = customers.filter(c => c.פעיל).length;
  const totalSites = sites.length;
  // Note: activeWorkOrders and completedWorkOrders are based on the unfiltered workOrders from useQuery
  const activeWorkOrders = workOrders.filter(w => w.סטטוס === 'פתוחה' || w.סטטוס === 'בטיפול').length;
  const completedWorkOrders = workOrders.filter(w => w.סטטוס === 'הושלמה').length;

  // הכנסות - עם פילטר
  const paidInvoices = filterByTimeRange(invoices.filter(inv => inv.סטטוס === 'שולמה'), 'תאריך');
  const filteredMonthlyRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.סכום_כולל || 0), 0);

  const pendingInvoices = filterByTimeRange(invoices.filter(inv => inv.סטטוס === 'טרם שולמה'), 'תאריך');
  const pendingRevenue = pendingInvoices.reduce((sum, inv) => sum + (inv.סכום_כולל || 0), 0);

  const draftInvoices = filterByTimeRange(invoices.filter(inv => inv.סטטוס === 'טיוטה'), 'תאריך');
  const draftRevenue = draftInvoices.reduce((sum, inv) => sum + (inv.סכום_כולל || 0), 0);

  // חישוב תשלומים לפי לקוח
  const getPaymentsByCustomer = () => {
    const customerPayments = {};
    
    const filteredInvoices = filterByTimeRange(invoices, 'תאריך');
    
    filteredInvoices.forEach(invoice => {
      const customer = customers.find(c => c.id === invoice.לקוח_id);
      const customerName = customer?.שם_לקוח || 'לקוח לא ידוע';
      const customerId = invoice.לקוח_id || 'unknown';
      
      // חישוב סכום ששולם מהתשלומים
      const invoicePayments = payments.filter(p => p.חשבונית_id === invoice.id);
      const paidAmount = invoicePayments.reduce((sum, p) => sum + (p.סכום_תשלום || 0), 0);
      
      if (!customerPayments[customerId]) {
        customerPayments[customerId] = {
          name: customerName,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          invoiceCount: 0
        };
      }
      
      customerPayments[customerId].totalAmount += invoice.סכום_כולל || 0;
      customerPayments[customerId].paidAmount += paidAmount;
      customerPayments[customerId].invoiceCount += 1;
    });
    
    // חישוב יתרה
    Object.keys(customerPayments).forEach(customerId => {
      customerPayments[customerId].remainingAmount = 
        customerPayments[customerId].totalAmount - customerPayments[customerId].paidAmount;
    });
    
    return Object.values(customerPayments)
      .filter(cp => cp.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  };

  // חישוב תשלומים לפי חודש
  const getPaymentsByMonth = () => {
    const monthlyPayments = {};
    
    const filteredInvoices = filterByTimeRange(invoices, 'תאריך');
    
    filteredInvoices.forEach(invoice => {
      const date = new Date(invoice.תאריך);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
      
      // חישוב סכום ששולם מהתשלומים
      const invoicePayments = payments.filter(p => p.חשבונית_id === invoice.id);
      const paidAmount = invoicePayments.reduce((sum, p) => sum + (p.סכום_תשלום || 0), 0);
      
      if (!monthlyPayments[monthKey]) {
        monthlyPayments[monthKey] = {
          month: monthName,
          monthKey: monthKey,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          invoiceCount: 0
        };
      }
      
      monthlyPayments[monthKey].totalAmount += invoice.סכום_כולל || 0;
      monthlyPayments[monthKey].paidAmount += paidAmount;
      monthlyPayments[monthKey].invoiceCount += 1;
    });
    
    // חישוב יתרה
    Object.keys(monthlyPayments).forEach(monthKey => {
      monthlyPayments[monthKey].remainingAmount = 
        monthlyPayments[monthKey].totalAmount - monthlyPayments[monthKey].paidAmount;
    });
    
    return Object.values(monthlyPayments)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  const customerPayments = getPaymentsByCustomer();
  const monthlyPayments = getPaymentsByMonth();


  // הצעות מחיר - עם פילטר
  const approvedQuotes = filterByTimeRange(quotes.filter(q => q.סטטוס === 'מאושרת'), 'תאריך_הצעה');
  const approvedQuotesValue = approvedQuotes.reduce((sum, q) => sum + (q.סכום_כולל || 0), 0);

  const pendingQuotes = filterByTimeRange(quotes.filter(q => q.סטטוס === 'נשלחה'), 'תאריך_הצעה');
  const pendingQuotesValue = pendingQuotes.reduce((sum, q) => sum + (q.סכום_כולל || 0), 0);

  // תיאור הפילטר הנוכחי
  const getFilterDescription = () => {
    if (timeRange === "all") return "כל הזמן";
    if (timeRange === "month") return "חודש אחרון";
    if (timeRange === "week") return "שבוע אחרון";
    if (timeRange === "specific-month") {
      const date = new Date(selectedMonth + "-01");
      return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
    }
    return "";
  };

  // פונקציה לייצוא לאקסל
  const exportToExcel = () => {
    // הכנת הנתונים
    const data = [];
    
    // כותרת
    data.push(['דוח הכנסות - ' + getFilterDescription()]);
    data.push([]);
    
    // סיכום כללי
    data.push(['סיכום כללי']);
    data.push(['לקוחות פעילים', activeCustomers]);
    data.push(['עבודות פעילות', activeWorkOrders]);
    data.push([]);
    
    // הכנסות
    data.push(['הכנסות']);
    data.push(['סוג', 'כמות חשבוניות', 'סכום']);
    data.push(['חשבוניות ששולמו', paidInvoices.length, filteredMonthlyRevenue.toFixed(2)]);
    data.push(['חשבוניות ממתינות', pendingInvoices.length, pendingRevenue.toFixed(2)]);
    data.push(['חשבוניות בטיוטה', draftInvoices.length, draftRevenue.toFixed(2)]);
    data.push([]);
    
    // פירוט חשבוניות ששולמו
    data.push(['פירוט חשבוניות ששולמו']);
    data.push(['מספר חשבון', 'לקוח', 'תאריך', 'סכום']);
    paidInvoices.forEach(inv => {
      const customer = customers.find(c => c.id === inv.לקוח_id);
      data.push([
        inv.מספר_חשבונית,
        customer?.שם_לקוח || '-',
        format(new Date(inv.תאריך), 'dd/MM/yyyy'),
        inv.סכום_כולל?.toFixed(2) || '0.00'
      ]);
    });

    data.push([]); // Add an empty row for spacing
    // פירוט חשבוניות שטרם שולמו
    data.push(['פירוט חשבוניות שטרם שולמו']);
    data.push(['מספר חשבון', 'לקוח', 'תאריך', 'סכום', 'ימים באיחור']);
    pendingInvoices.forEach(inv => {
      const customer = customers.find(c => c.id === inv.לקוח_id);
      const invoiceDate = new Date(inv.תאריך);
      const daysOverdue = Math.floor((new Date() - invoiceDate) / (1000 * 60 * 60 * 24));
      data.push([
        inv.מספר_חשבונית,
        customer?.שם_לקוח || '-',
        format(new Date(inv.תאריך), 'dd/MM/yyyy'),
        inv.סכום_כולל?.toFixed(2) || '0.00',
        daysOverdue
      ]);
    });

    data.push([]); // Add an empty row for spacing
    // פירוט תשלומים לפי לקוח
    data.push(['פירוט תשלומים לפי לקוח']);
    data.push(['שם לקוח', 'מספר חשבונות', 'סכום כולל', 'שולם', 'נותר לתשלום', 'אחוז תשלום']);
    customerPayments.forEach(cp => {
      const paymentPercentage = cp.totalAmount > 0 
        ? (cp.paidAmount / cp.totalAmount * 100).toFixed(0)
        : 0;
      data.push([
        cp.name,
        cp.invoiceCount,
        cp.totalAmount.toFixed(2),
        cp.paidAmount.toFixed(2),
        cp.remainingAmount.toFixed(2),
        `${paymentPercentage}%`
      ]);
    });

    data.push([]); // Add an empty row for spacing
    // פירוט תשלומים לפי חודש
    data.push(['פירוט תשלומים לפי חודש']);
    data.push(['חודש', 'מספר חשבונות', 'סכום כולל', 'שולם', 'נותר לתשלום', 'אחוז תשלום']);
    monthlyPayments.forEach(mp => {
      const paymentPercentage = mp.totalAmount > 0 
        ? (mp.paidAmount / mp.totalAmount * 100).toFixed(0)
        : 0;
      data.push([
        mp.month,
        mp.invoiceCount,
        mp.totalAmount.toFixed(2),
        mp.paidAmount.toFixed(2),
        mp.remainingAmount.toFixed(2),
        `${paymentPercentage}%`
      ]);
    });
    
    // המרה ל-CSV
    const csv = data.map(row => row.join(',')).join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Hebrew support
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `דוח_הכנסות_${getFilterDescription().replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const statsCards = [
    {
      title: "הכנסות ששולמו",
      value: `₪${filteredMonthlyRevenue.toFixed(2)}`,
      subtitle: `${paidInvoices.length} חשבוניות`,
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-700"
    },
    {
      title: "הכנסות ממתינות",
      value: `₪${pendingRevenue.toFixed(2)}`,
      subtitle: `${pendingInvoices.length} חשבוניות`,
      icon: TrendingUp,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700"
    },
    {
      title: "בדיקות דחופות", // Note: This now relies on `sites` directly, without the `upcomingInspections` and `overdueInspections` variables.
      value: sites.filter(s => { // Re-calculating directly here
        if (!s.תאריך_בדיקה_הבאה) return false;
        const daysUntil = Math.floor((new Date(s.תאריך_בדיקה_הבאה) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30; // Within 30 days or overdue
      }).length,
      subtitle: `${sites.filter(s => { // Re-calculating directly here
        if (!s.תאריך_בדיקה_הבאה) return false;
        const daysUntil = Math.floor((new Date(s.תאריך_בדיקה_הבאה) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntil < 0;
      }).length} באיחור`,
      icon: Calendar,
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50",
      textColor: "text-red-700"
    },
    {
      title: "עבודות פעילות",
      value: activeWorkOrders,
      subtitle: `${completedWorkOrders} הושלמו`,
      icon: ClipboardList,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700"
    }
  ];

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 md:w-8 md:h-8" />
              דוחות וסטטיסטיקות
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">סיכום נתונים ודוחות מערכת</p>
            {timeRange !== "all" && (
              <p className="text-xs md:text-sm text-blue-600 font-medium mt-1">
                מציג נתונים עבור: {getFilterDescription()}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={exportToExcel}
              className="border-green-600 text-green-600 hover:bg-green-50 text-sm md:text-base"
            >
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              ייצוא לאקסל
            </Button>
            <Button
              variant={showMonthlyRevenue ? "default" : "outline"}
              onClick={() => setShowMonthlyRevenue(!showMonthlyRevenue)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base"
            >
              <TrendingUp className="w-4 h-4 ml-2" />
              הכנסות לפי חודש
            </Button>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-[200px] text-sm md:text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הזמן</SelectItem>
                <SelectItem value="month">חודש אחרון</SelectItem>
                <SelectItem value="week">שבוע אחרון</SelectItem>
                <SelectItem value="specific-month">חודש ספציפי...</SelectItem>
              </SelectContent>
            </Select>
            {timeRange === "specific-month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[180px] text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {showMonthlyRevenue && (
          <Card className="shadow-lg mb-8">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                דוח הכנסות לפי חודש
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {monthlyRevenueData.length > 0 ? (
                <>
                  <div className="h-[400px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyRevenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          label={{ value: 'הכנסות (₪)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip 
                          formatter={(value) => [`₪${value.toFixed(2)}`, 'הכנסות']}
                          labelStyle={{ direction: 'rtl' }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="revenue" 
                          fill="#16a34a" 
                          name="הכנסות"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">פירוט הכנסות לפי חודש:</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>חודש</TableHead>
                          <TableHead>מספר חשבוניות</TableHead>
                          <TableHead>סה"כ הכנסות</TableHead>
                          <TableHead>ממוצע לחשבונית</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyRevenueData.map((month, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{month.month}</TableCell>
                            <TableCell>
                              <Badge className="bg-blue-100 text-blue-800">{month.count}</Badge>
                            </TableCell>
                            <TableCell className="font-bold text-green-600">
                              ₪{month.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              ₪{(month.revenue / (month.count || 1)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-bold">
                          <TableCell>סה"כ</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-600 text-white">
                              {monthlyRevenueData.reduce((sum, m) => sum + m.count, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-600 text-lg">
                            ₪{monthlyRevenueData.reduce((sum, m) => sum + m.revenue, 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            ₪{(monthlyRevenueData.reduce((sum, m) => sum + m.revenue, 0) / 
                               (monthlyRevenueData.reduce((sum, m) => sum + m.count, 0) || 1)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">אין נתוני הכנסות</p>
                  <p className="text-sm mt-2">לא נמצאו חשבוניות ששולמו במערכת</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="p-4 md:pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600">{stat.title}</p>
                    <CardTitle className="xl md:text-2xl font-bold mt-2">
                      {stat.value}
                    </CardTitle>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                  </div>
                  <div className={`p-2 md:p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.textColor}`} />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
        
        <div className="grid lg:grid-cols-1 gap-6"> 
          {/* חשבוניות שטרם שולמו */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                חשבוניות שטרם שולמו
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingInvoices.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">מספר חשבון</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">לקוח</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">תאריך</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">סכום</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center py-4">ימים באיחור</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingInvoices.map((invoice, index) => {
                          const customer = customers.find(c => c.id === invoice.לקוח_id);
                          const invoiceDate = new Date(invoice.תאריך);
                          const daysOverdue = Math.floor((new Date() - invoiceDate) / (1000 * 60 * 60 * 24));
                          return (
                            <TableRow key={invoice.id} className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                              <TableCell className="font-medium border-l border-gray-200 text-center py-3">{invoice.מספר_חשבונית}</TableCell>
                              <TableCell className="border-l border-gray-200 text-center py-3">{customer?.שם_לקוח || '-'}</TableCell>
                              <TableCell className="border-l border-gray-200 text-center py-3">{format(invoiceDate, 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="font-bold text-orange-600 border-l border-gray-200 text-center py-3">
                                ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <Badge className={daysOverdue > 30 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}>
                                  {daysOverdue} ימים
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {pendingInvoices.map((invoice) => {
                      const customer = customers.find(c => c.id === invoice.לקוח_id);
                      const invoiceDate = new Date(invoice.תאריך);
                      const daysOverdue = Math.floor((new Date() - invoiceDate) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={invoice.id} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-gray-900">
                              חשבון #{invoice.מספר_חשבונית}
                            </div>
                            <Badge className={daysOverdue > 30 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}>
                              {daysOverdue} ימים
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {customer?.שם_לקוח || '-'}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            תאריך: {format(invoiceDate, 'dd/MM/yyyy')}
                          </div>
                          <div className="text-lg font-bold text-orange-600">
                            ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* סיכום */}
                  <div className="border-t bg-gray-50 p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">סה"כ חשבוניות שטרם שולמו:</span>
                      <span className="text-xl font-bold text-orange-600">
                        ₪{pendingRevenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">🎉 אין חשבוניות שטרם שולמו</p>
                  <p className="text-sm mt-2">כל החשבוניות שולמו!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* תשלומים לפי לקוח */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                תשלומים לפי לקוח
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {customerPayments.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">שם לקוח</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">מספר חשבונות</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">סכום כולל</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">שולם</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">נותר לתשלום</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center py-4">אחוז תשלום</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerPayments.map((customer, index) => {
                          const paymentPercentage = customer.totalAmount > 0 
                            ? (customer.paidAmount / customer.totalAmount * 100).toFixed(0)
                            : 0;
                          return (
                            <TableRow key={index} className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                              <TableCell className="font-medium border-l border-gray-200 text-center py-3">{customer.name}</TableCell>
                              <TableCell className="border-l border-gray-200 text-center py-3">
                                <Badge className="bg-blue-100 text-blue-800">{customer.invoiceCount}</Badge>
                              </TableCell>
                              <TableCell className="font-bold border-l border-gray-200 text-center py-3">₪{customer.totalAmount.toFixed(2)}</TableCell>
                              <TableCell className="text-green-600 font-medium border-l border-gray-200 text-center py-3">
                                ₪{customer.paidAmount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-orange-600 font-medium border-l border-gray-200 text-center py-3">
                                ₪{customer.remainingAmount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-3 border border-gray-300">
                                    <div 
                                      className="bg-green-500 h-full rounded-full" 
                                      style={{width: `${paymentPercentage}%`}}
                                    />
                                  </div>
                                  <span className="text-sm text-gray-700 font-medium min-w-[35px]">{paymentPercentage}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {customerPayments.map((customer, index) => {
                      const paymentPercentage = customer.totalAmount > 0 
                        ? (customer.paidAmount / customer.totalAmount * 100).toFixed(0)
                        : 0;
                      return (
                        <div key={index} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-gray-900">{customer.name}</div>
                            <Badge className="bg-blue-100 text-blue-800">{customer.invoiceCount} חשבונות</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">סכום כולל:</span>
                              <span className="font-bold">₪{customer.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">שולם:</span>
                              <span className="text-green-600 font-medium">₪{customer.paidAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">נותר:</span>
                              <span className="text-orange-600 font-medium">₪{customer.remainingAmount.toFixed(2)}</span>
                            </div>
                            <div className="pt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-1 border border-gray-300">
                                <div 
                                  className="bg-green-500 h-full rounded-full" 
                                  style={{width: `${paymentPercentage}%`}}
                                />
                              </div>
                              <div className="text-xs text-gray-600 text-center">{paymentPercentage}% שולם</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>אין נתוני תשלומים</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* תשלומים לפי חודש */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                תשלומים לפי חודש
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {monthlyPayments.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100 border-b-2 border-gray-300">
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">חודש</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">מספר חשבונות</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">סכום כולל</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">שולם</TableHead>
                          <TableHead className="font-bold text-gray-900 border-l text-center py-4">נותר לתשלום</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center py-4">אחוז תשלום</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyPayments.map((month, index) => {
                          const paymentPercentage = month.totalAmount > 0 
                            ? (month.paidAmount / month.totalAmount * 100).toFixed(0)
                            : 0;
                          return (
                            <TableRow key={index} className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                              <TableCell className="font-medium border-l border-gray-200 text-center py-3">{month.month}</TableCell>
                              <TableCell className="border-l border-gray-200 text-center py-3">
                                <Badge className="bg-purple-100 text-purple-800">{month.invoiceCount}</Badge>
                              </TableCell>
                              <TableCell className="font-bold border-l border-gray-200 text-center py-3">₪{month.totalAmount.toFixed(2)}</TableCell>
                              <TableCell className="text-green-600 font-medium border-l border-gray-200 text-center py-3">
                                ₪{month.paidAmount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-orange-600 font-medium border-l border-gray-200 text-center py-3">
                                ₪{month.remainingAmount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-3 border border-gray-300">
                                    <div 
                                      className="bg-green-500 h-full rounded-full" 
                                      style={{width: `${paymentPercentage}%`}}
                                    />
                                  </div>
                                  <span className="text-sm text-gray-700 font-medium min-w-[35px]">{paymentPercentage}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {monthlyPayments.map((month, index) => {
                      const paymentPercentage = month.totalAmount > 0 
                        ? (month.paidAmount / month.totalAmount * 100).toFixed(0)
                        : 0;
                      return (
                        <div key={index} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-gray-900">{month.month}</div>
                            <Badge className="bg-purple-100 text-purple-800">{month.invoiceCount} חשבונות</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">סכום כולל:</span>
                              <span className="font-bold">₪{month.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">שולם:</span>
                              <span className="text-green-600 font-medium">₪{month.paidAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">נותר:</span>
                              <span className="text-orange-600 font-medium">₪{month.remainingAmount.toFixed(2)}</span>
                            </div>
                            <div className="pt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-1 border border-gray-300">
                                <div 
                                  className="bg-green-500 h-full rounded-full" 
                                  style={{width: `${paymentPercentage}%`}}
                                />
                              </div>
                              <div className="text-xs text-gray-600 text-center">{paymentPercentage}% שולם</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>אין נתוני תשלומים</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* סיכום הכנסות */}
          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <CardTitle>סיכום הכנסות</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <span className="font-medium">חשבוניות ששולמו</span>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-green-600">₪{filteredMonthlyRevenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">{paidInvoices.length} חשבוניות</div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                  <span className="font-medium">חשבוניות ממתינות</span>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-orange-600">₪{pendingRevenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">{pendingInvoices.length} חשבוניות</div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">חשבוניות בטיוטה</span>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-gray-600">₪{draftRevenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">{draftInvoices.length} חשבוניות</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
