
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, FileText, Search, Printer, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function QuotesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLineItems, setShowLineItems] = useState(false);
  const [currentQuoteId, setCurrentQuoteId] = useState(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [pendingApprovedQuote, setPendingApprovedQuote] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [lineItemForm, setLineItemForm] = useState({
    פריט_id: "",
    תיאור: "",
    סוג_שורה: "פריט",
    כמות: 1,
    מחיר_יחידה: 0,
    הנחה_אחוז: 0
  });
  
  const [formData, setFormData] = useState({
    לקוח_id: "",
    תאריך_הצעה: new Date().toISOString().split('T')[0],
    תוקף_עד: "",
    סטטוס: "טיוטה",
    הערות: ""
  });

  const queryClient = useQueryClient();

  const { data: quotes } = useQuery({
    queryKey: ['הצעת_מחיר'],
    queryFn: () => base44.entities.הצעת_מחיר.list('-created_date'),
    initialData: [],
  });

  const { data: customers } = useQuery({
    queryKey: ['לקוח'],
    queryFn: () => base44.entities.לקוח.list(),
    initialData: [],
  });

  const { data: quoteLines } = useQuery({
    queryKey: ['שורת_הצעה'],
    queryFn: () => base44.entities.שורת_הצעה.list(),
    initialData: [],
  });

  const { data: items } = useQuery({
    queryKey: ['פריט'],
    queryFn: () => base44.entities.פריט.list(),
    initialData: [],
  });

  const createQuoteMutation = useMutation({
    mutationFn: (data) => base44.entities.הצעת_מחיר.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['הצעת_מחיר'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.הצעת_מחיר.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['הצעת_מחיר'] });
      setIsDialogOpen(false);
      
      if (variables.data.סטטוס === "מאושרת") {
        setPendingApprovedQuote(variables.id);
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setShowInvoiceDialog(true);
      }
      
      resetForm();
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => base44.entities.הצעת_מחיר.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['הצעת_מחיר'] });
    },
  });

  const createLineMutation = useMutation({
    mutationFn: (data) => base44.entities.שורת_הצעה.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['שורת_הצעה'] });
      setTimeout(async () => {
        await recalculateQuoteTotals(currentQuoteId);
      }, 300);
      resetLineForm();
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id) => base44.entities.שורת_הצעה.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['שורת_הצעה'] });
      setTimeout(async () => {
        await recalculateQuoteTotals(currentQuoteId);
      }, 300);
    },
  });

  const recalculateQuoteTotals = async (quoteId) => {
    const allLines = await base44.entities.שורת_הצעה.list();
    const lines = allLines.filter(l => l.הצעת_מחיר_id === quoteId);
    
    let total = 0;
    
    for (const line of lines) {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      total += lineTotal;
    }
    
    const vat = total * 0.18;
    const totalWithVat = total + vat;
    
    await base44.entities.הצעת_מחיר.update(quoteId, {
      סכום_לפני_מעם: total,
      מעם: vat,
      סכום_כולל: totalWithVat
    });
    
    await queryClient.invalidateQueries({ queryKey: ['הצעת_מחיר'] });
  };

  const createInvoiceFromQuote = async () => {
    try {
      const allQuotes = await base44.entities.הצעת_מחיר.list();
      const quote = allQuotes.find(q => q.id === pendingApprovedQuote);
      
      if (!quote) {
        alert('שגיאה: לא נמצאה הצעת מחיר');
        return;
      }

      // מציאת מספר החשבון הבא
      const allInvoices = await base44.entities.חשבונית.list();
      let nextInvoiceNumber = 7527; // Starting number
      if (allInvoices.length > 0) {
        const existingNumbers = allInvoices
          .map(inv => parseInt(inv.מספר_חשבונית)) // Convert to int
          .filter(num => !isNaN(num)); // Filter out non-numeric invoice numbers
        
        if (existingNumbers.length > 0) {
          const maxNumber = Math.max(...existingNumbers);
          nextInvoiceNumber = Math.max(maxNumber + 1, nextInvoiceNumber); // Ensure it's at least 7527
        }
      }
      
      const invoiceNumber = nextInvoiceNumber.toString();
      
      const newInvoice = await base44.entities.חשבונית.create({
        מספר_חשבונית: invoiceNumber,
        לקוח_id: quote.לקוח_id,
        תאריך: invoiceDate,
        סטטוס: "טיוטה",
        הערות: `נוצרה מהצעת מחיר ${quote.מספר_הצעה}`,
        סכום_לפני_מעם: quote.סכום_לפני_מעם || 0,
        מעם: quote.מעם || 0,
        סכום_כולל: quote.סכום_כולל || 0
      });

      const allLines = await base44.entities.שורת_הצעה.list();
      const quoteLines = allLines.filter(l => l.הצעת_מחיר_id === pendingApprovedQuote);
      
      for (const line of quoteLines) {
        await base44.entities.שורת_חשבונית.create({
          חשבונית_id: newInvoice.id,
          פריט_id: line.פריט_id || null,
          תיאור: line.תיאור,
          סוג_שורה: line.סוג_שורה || "פריט",
          כמות: line.כמות,
          מחיר_יחידה: line.מחיר_יחידה,
          הנחה_אחוז: line.הנחה_אחוז,
          סכום_שורה: (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100))
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
      await queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });
      
      setShowInvoiceDialog(false);
      setPendingApprovedQuote(null);
      
      alert('החשבונית נוצרה בהצלחה!');
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert('שגיאה ביצירת חשבונית: ' + (error.message || "נסה שוב מאוחר יותר."));
    }
  };

  const resetForm = () => {
    setFormData({
      לקוח_id: "",
      תאריך_הצעה: new Date().toISOString().split('T')[0],
      תוקף_עד: "",
      סטטוס: "טיוטה",
      הערות: ""
    });
    setEditingQuote(null);
  };

  const resetLineForm = () => {
    setLineItemForm({
      פריט_id: "",
      תיאור: "",
      סוג_שורה: "פריט",
      כמות: 1,
      מחיר_יחידה: 0,
      הנחה_אחוז: 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingQuote) {
      updateQuoteMutation.mutate({ id: editingQuote.id, data: formData });
    } else {
      const quoteNumber = `HM-${Date.now().toString().slice(-6)}`;
      const dataToSubmit = {
        ...formData,
        מספר_הצעה: quoteNumber,
        סכום_לפני_מעם: 0,
        מעם: 0,
        סכום_כולל: 0
      };
      createQuoteMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (quote) => {
    setEditingQuote(quote);
    setFormData({
      לקוח_id: quote.לקוח_id,
      תאריך_הצעה: quote.תאריך_הצעה,
      תוקף_עד: quote.תוקף_עד || "",
      סטטוס: quote.סטטוס,
      הערות: quote.הערות || ""
    });
    setIsDialogOpen(true);
  };

  const handleManageLines = async (quoteId) => {
    setCurrentQuoteId(quoteId);
    setShowLineItems(true);
    await recalculateQuoteTotals(quoteId);
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    
    createLineMutation.mutate({
      הצעת_מחיר_id: currentQuoteId,
      פריט_id: lineItemForm.פריט_id || null,
      תיאור: lineItemForm.תיאור,
      סוג_שורה: lineItemForm.סוג_שורה || "פריט",
      כמות: lineItemForm.כמות,
      מחיר_יחידה: lineItemForm.מחיר_יחידה,
      הנחה_אחוז: lineItemForm.הנחה_אחוז,
    });
  };

  const handleItemSelect = (itemId) => {
    if (!itemId) {
      setLineItemForm({
        ...lineItemForm,
        פריט_id: "",
        תיאור: "",
        מחיר_יחידה: 0,
        סוג_שורה: "פריט"
      });
      return;
    }
    
    const selectedItem = items.find(i => i.id === itemId);
    if (selectedItem) {
      setLineItemForm({
        ...lineItemForm,
        פריט_id: itemId,
        תיאור: selectedItem.שם_פריט,
        מחיר_יחידה: selectedItem.מחיר_מכירה,
        סוג_שורה: selectedItem.סוג_פריט
      });
    }
  };

  const handlePrint = async (quoteId) => {
    const response = await base44.functions.invoke('renderQuotePrintView', { quoteId });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(response.data);
    printWindow.document.close();
  };

  const getCustomerName = (id) => customers.find(c => c.id === id)?.שם_לקוח || '-';

  const currentQuoteLines = quoteLines.filter(l => l.הצעת_מחיר_id === currentQuoteId);

  const calculateCurrentTotals = () => {
    let subtotal = 0;
    currentQuoteLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      subtotal += lineTotal;
    });
    const vat = subtotal * 0.18;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const currentTotals = calculateCurrentTotals();

  const statusColors = {
    "טיוטה": "bg-gray-100 text-gray-800",
    "נשלחה": "bg-blue-100 text-blue-800",
    "מאושרת": "bg-green-100 text-green-800",
    "בוטלה": "bg-red-100 text-red-800"
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-8 h-8" />
              ניהול הצעות מחיר
            </h1>
            <p className="text-gray-600 mt-1">רשימת כל הצעות המחיר במערכת</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={resetForm}>
                <Plus className="w-4 h-4 ml-2" />
                הצעה חדשה
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingQuote ? 'עריכת הצעת מחיר' : 'הצעת מחיר חדשה'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>לקוח *</Label>
                  <Select value={formData.לקוח_id} onValueChange={(value) => setFormData({...formData, לקוח_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר לקוח" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.שם_לקוח}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>תאריך הצעה *</Label>
                    <Input
                      type="date"
                      value={formData.תאריך_הצעה}
                      onChange={(e) => setFormData({...formData, תאריך_הצעה: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>תוקף עד</Label>
                    <Input
                      type="date"
                      value={formData.תוקף_עד}
                      onChange={(e) => setFormData({...formData, תוקף_עד: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  <Select value={formData.סטטוס} onValueChange={(value) => setFormData({...formData, סטטוס: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="טיוטה">טיוטה</SelectItem>
                      <SelectItem value="נשלחה">נשלחה</SelectItem>
                      <SelectItem value="מאושרת">מאושרת</SelectItem>
                      <SelectItem value="בוטלה">בוטלה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>הערות</Label>
                  <Textarea
                    value={formData.הערות}
                    onChange={(e) => setFormData({...formData, הערות: e.target.value})}
                    placeholder="הערות נוספות"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingQuote ? 'עדכן' : 'צור הצעה'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>יצירת חשבונית מהצעה מאושרת</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-green-800 font-medium">
                  ✓ הצעת המחיר אושרה בהצלחה!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  האם תרצה ליצור חשבונית ללקוח על סמך הצעה זו?
                </p>
              </div>
              
              <div>
                <Label>תאריך הוצאת החשבונית</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="text-right"
                />
                <p className="text-xs text-gray-500 mt-1">
                  בחר את התאריך שבו תרצה להוציא את החשבונית
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowInvoiceDialog(false);
                    setPendingApprovedQuote(null);
                  }}
                >
                  לא, תודה
                </Button>
                <Button 
                  type="button"
                  onClick={createInvoiceFromQuote}
                  className="bg-green-600 hover:bg-green-700"
                >
                  כן, צור חשבונית
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLineItems} onOpenChange={setShowLineItems}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול שורות הצעת מחיר</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleAddLine} className="border-b pb-4 mb-4">
              <div className="grid grid-cols-1 gap-3 mb-3">
                <div>
                  <Label>בחר פריט (אופציונלי)</Label>
                  <Select value={lineItemForm.פריט_id || ""} onValueChange={handleItemSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר פריט מהרשימה או הזן ידנית" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>ללא - הזנה ידנית</SelectItem>
                      {items.filter(i => i.פעיל).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          [{item.סוג_פריט}] {item.שם_פריט} - ₪{item.מחיר_מכירה?.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <Label>תיאור</Label>
                  <Input
                    value={lineItemForm.תיאור}
                    onChange={(e) => setLineItemForm({...lineItemForm, תיאור: e.target.value})}
                    placeholder="תיאור פריט/שירות"
                    required
                  />
                </div>
                <div>
                  <Label>סוג</Label>
                  <Select value={lineItemForm.סוג_שורה || "פריט"} onValueChange={(value) => setLineItemForm({...lineItemForm, סוג_שורה: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="עבודה">עבודה</SelectItem>
                      <SelectItem value="פריט">פריט</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>כמות</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lineItemForm.כמות}
                    onChange={(e) => setLineItemForm({...lineItemForm, כמות: parseFloat(e.target.value) || 0})}
                    required
                  />
                </div>
                <div>
                  <Label>מחיר</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItemForm.מחיר_יחידה}
                    onChange={(e) => setLineItemForm({...lineItemForm, מחיר_יחידה: parseFloat(e.target.value) || 0})}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3 mt-3">
                <div>
                  <Label>הנחה %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={lineItemForm.הנחה_אחוז}
                    onChange={(e) => setLineItemForm({...lineItemForm, הנחה_אחוז: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="col-span-4 flex items-end">
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 ml-2" />
                    הוסף שורה
                  </Button>
                </div>
              </div>
            </form>

            {currentQuoteLines.length > 0 ? (
              <div className="space-y-6">
                {currentQuoteLines.filter(l => l.סוג_שורה === 'עבודה').length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800">עבודה</Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>תיאור</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>מחיר יחידה</TableHead>
                          <TableHead>הנחה %</TableHead>
                          <TableHead>סה"כ</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentQuoteLines.filter(l => l.סוג_שורה === 'עבודה').map((line) => {
                          const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
                          return (
                            <TableRow key={line.id}>
                              <TableCell>{line.תיאור}</TableCell>
                              <TableCell>{line.כמות}</TableCell>
                              <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                              <TableCell>{line.הנחה_אחוז || 0}%</TableCell>
                              <TableCell className="font-bold">₪{lineTotal.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteLineMutation.mutate(line.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {currentQuoteLines.filter(l => l.סוג_שורה === 'פריט').length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">פריטים</Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>תיאור</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>מחיר יחידה</TableHead>
                          <TableHead>הנחה %</TableHead>
                          <TableHead>סה"כ</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentQuoteLines.filter(l => l.סוג_שורה === 'פריט').map((line) => {
                          const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
                          return (
                            <TableRow key={line.id}>
                              <TableCell>{line.תיאור}</TableCell>
                              <TableCell>{line.כמות}</TableCell>
                              <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                              <TableCell>{line.הנחה_אחוז || 0}%</TableCell>
                              <TableCell className="font-bold">₪{lineTotal.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteLineMutation.mutate(line.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50 mb-4">
                <p>אין שורות בהצעה זו</p>
                <p className="text-sm mt-1">הוסף שורות באמצעות הטופס למעלה</p>
              </div>
            )}

            <div className="border-t pt-4 mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between text-lg">
                  <span className="font-medium">סכום לפני מע"מ:</span>
                  <span className="font-bold">₪{currentTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-medium">מע"מ (18%):</span>
                  <span className="font-bold">₪{currentTotals.vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl border-t-2 pt-3 mt-3">
                  <span className="font-bold">סה"כ כולל מע"מ:</span>
                  <span className="font-bold text-blue-600">₪{currentTotals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button type="button" onClick={() => setShowLineItems(false)} className="bg-blue-600 hover:bg-blue-700">
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="חיפוש הצעה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר הצעה</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes
                  .filter(quote => 
                    quote.מספר_הצעה?.includes(searchTerm) || 
                    getCustomerName(quote.לקוח_id).includes(searchTerm)
                  )
                  .map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.מספר_הצעה}</TableCell>
                    <TableCell>{getCustomerName(quote.לקוח_id)}</TableCell>
                    <TableCell>{format(new Date(quote.תאריך_הצעה), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-bold text-blue-600">
                      ₪{quote.סכום_כולל?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[quote.סטטוס]}>
                        {quote.סטטוס}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(quote)} 
                          title="ערוך פרטי הצעה"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleManageLines(quote.id)} 
                          title="ניהול שורות"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handlePrint(quote.id)} 
                          title="תצוגת הדפסה"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteQuoteMutation.mutate(quote.id)}
                          className="text-red-600 hover:text-red-700"
                          title="מחק הצעה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
