
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Receipt,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
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

  const activeCustomers = customers.filter(c => c.פעיל).length;
  
  const paidInvoices = invoices.filter(i => i.סטטוס === 'שולמה');
  const unpaidInvoices = invoices.filter(i => i.סטטוס === 'טרם שולמה');
  
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.סכום_כולל || 0), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.סכום_כולל || 0), 0);

  const statsCards = [
    {
      title: "לקוחות פעילים",
      value: activeCustomers,
      icon: Users,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700"
    },
    {
      title: "חשבוניות ששולמו",
      value: `₪${totalPaid.toFixed(2)}`,
      icon: CheckCircle2,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      subtitle: `${paidInvoices.length} חשבוניות`
    },
    {
      title: "חשבוניות טרם שולמו",
      value: `₪${totalUnpaid.toFixed(2)}`,
      icon: Clock,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      subtitle: `${unpaidInvoices.length} חשבוניות`
    }
  ];

  const statusColors = {
    "טיוטה": "bg-gray-100 text-gray-800",
    "טרם שולמה": "bg-orange-100 text-orange-800",
    "שולמה": "bg-green-100 text-green-800"
  };

  return (
    <div className="p-3 md:p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">דשבורד ראשי</h1>
          <p className="text-sm md:text-base text-gray-600">סקירה כללית של מערכת ניהול ההתקנות</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`absolute top-0 left-0 w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -translate-x-8 -translate-y-8`} />
              <CardHeader className="p-4 md:p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-xs md:text-sm font-medium text-gray-600">{stat.title}</p>
                    <CardTitle className="text-xl md:text-3xl font-bold mt-2">
                      {stat.value}
                    </CardTitle>
                    {stat.subtitle && (
                      <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                    )}
                  </div>
                  <div className={`p-2 md:p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.textColor}`} />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Recent Invoices */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Receipt className="w-5 h-5 md:w-6 md:h-6" />
              חשבונות אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">מספר חשבון</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">תאריך</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">סכום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.slice(0, 8).map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{invoice.מספר_חשבונית}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(invoice.תאריך), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 font-bold text-green-600">
                        ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={statusColors[invoice.סטטוס]}>
                          {invoice.סטטוס}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {invoices.slice(0, 8).map((invoice) => (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900">
                      חשבונית #{invoice.מספר_חשבונית}
                    </div>
                    <Badge className={statusColors[invoice.סטטוס]}>
                      {invoice.סטטוס}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    תאריך: {format(new Date(invoice.תאריך), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ))}
            </div>

            {invoices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>אין חשבוניות</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
