import React, { useState, useEffect, useRef } from "react";
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
import { Plus, Edit, Trash2, Receipt, Search, Printer, Eye, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, FileText, Download, DollarSign, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function InvoicesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLineItems, setShowLineItems] = useState(false);
  const [currentInvoiceId, setCurrentInvoiceId] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [workSearch, setWorkSearch] = useState("");
  const [itemSearchText, setItemSearchText] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [globalIncludeLinkedWorks, setGlobalIncludeLinkedWorks] = useState(true);

  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [localLineSorts, setLocalLineSorts] = useState({});

  const [isFillingCodes, setIsFillingCodes] = useState(false);

  // The outline suggested removing showAddPaymentDialog here, but it is a valid state
  // used for the payments functionality and its removal would cause a bug.
  // Preserving existing functionality as per instructions.
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    description: "",
    תאריך_מסמך: new Date().toISOString().split('T')[0]
  });

  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false); // New state
  const [currentInvoiceForPayments, setCurrentInvoiceForPayments] = useState(null); // New state
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false); // New state
  const [paymentForm, setPaymentForm] = useState({ // New state
    סכום_תשלום: "",
    תאריך_תשלום: new Date().toISOString().split('T')[0],
    אמצעי_תשלום: "מזומן",
    מספר_אסמכתא: "",
    הערות: ""
  });

  const [show493Dialog, setShow493Dialog] = useState(false);
  const [pending493Invoice, setPending493Invoice] = useState(null);
  const [pending493Action, setPending493Action] = useState(null);
  const [num493Input, setNum493Input] = useState("");

  const [lineItemForm, setLineItemForm] = useState({
    פריט_id: "",
    תיאור: "",
    כמות: 1,
    מחיר_יחידה: 0,
    הנחה_אחוז: 0,
    סוג_שורה: "עבודה",
    מיון_שורות: 1,
    includeLinkedWorks: true
  });

  const [formData, setFormData] = useState({
    לקוח_id: "",
    טכנאי_id: "",
    מספר_דוח: "",
    מספר_493: "",
    תאריך: new Date().toISOString().split('T')[0],
    סטטוס: "טיוטה", // Initial status, will be managed by payment system
    סכום_שולם: 0, // Initialized but managed by payment system
    הערות: ""
  });

  const queryClient = useQueryClient();

  const { data: invoices } = useQuery({
    queryKey: ['חשבונית'],
    queryFn: () => base44.entities.חשבונית.list('-created_date'),
    initialData: [],
  });

  const { data: customers } = useQuery({
    queryKey: ['לקוח'],
    queryFn: () => base44.entities.לקוח.list(),
    initialData: [],
  });

  const { data: technicians } = useQuery({
    queryKey: ['טכנאי'],
    queryFn: () => base44.entities.טכנאי.list(),
    initialData: [],
  });

  const { data: invoiceLines } = useQuery({
    queryKey: ['שורת_חשבונית'],
    queryFn: () => base44.entities.שורת_חשבונית.list(),
    initialData: [],
  });

  const { data: items } = useQuery({
    queryKey: ['פריט'],
    queryFn: () => base44.entities.פריט.list(),
    initialData: [],
  });

  const { data: documents } = useQuery({
    queryKey: ['מסמך_חשבונית'],
    queryFn: () => base44.entities.מסמך_חשבונית.list('-created_date'),
    initialData: [],
  });

  const { data: payments } = useQuery({ // New query for invoice payments
    queryKey: ['תשלום_חשבונית'],
    queryFn: () => base44.entities.תשלום_חשבונית.list('-created_date'),
    initialData: [],
  });

  // בדיקה אם יש לקוח חדש מה-URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const newCustomerId = urlParams.get('newCustomerId');
    
    if (newCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === newCustomerId);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          לקוח_id: newCustomerId,
          מספר_דוח: customer.מספר_הוראת_עבודה || ""
        }));
        setCustomerSearch(customer.שם_לקוח);
        setIsDialogOpen(true);
        
        // ניקוי הפרמטר מה-URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [customers]);

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => base44.entities.חשבונית.create(data),
    onSuccess: (newInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
      setIsDialogOpen(false);
      resetForm();

      setCurrentInvoiceId(newInvoice.id);
      setShowLineItems(true);
      // After creating invoice, also trigger payment status update in case total is 0
      updateInvoicePaymentStatus(newInvoice.id);
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.חשבונית.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
      setIsDialogOpen(false);
      // Removed setShowPaymentDialog(false);
      resetForm();
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => base44.entities.חשבונית.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
    },
  });

  const createLineMutation = useMutation({
    mutationFn: (data) => base44.entities.שורת_חשבונית.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.שורת_חשבונית.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });
      await recalculateInvoiceTotals(currentInvoiceId);
    },
  });

  const bulkUpdateLinesMutation = useMutation({
    mutationFn: async (updates) => {
      await Promise.all(updates.map(update =>
        base44.entities.שורת_חשבונית.update(update.id, update.data)
      ));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });
      await recalculateInvoiceTotals(currentInvoiceId);
      setLocalLineSorts({});
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id) => base44.entities.שורת_חשבונית.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });
      await recalculateInvoiceTotals(currentInvoiceId);
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: (data) => base44.entities.מסמך_חשבונית.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['מסמך_חשבונית'] });
      setDocumentForm({
        description: "",
        תאריך_מסמך: new Date().toISOString().split('T')[0]
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => base44.entities.מסמך_חשבונית.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['מסמך_חשבונית'] });
    },
  });

  const createPaymentMutation = useMutation({ // New mutation for creating payment records
    mutationFn: (data) => base44.entities.תשלום_חשבונית.create(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['תשלום_חשבונית'] });
      if (currentInvoiceForPayments) {
        await updateInvoicePaymentStatus(currentInvoiceForPayments);
      }
      setPaymentForm({
        סכום_תשלום: "",
        תאריך_תשלום: new Date().toISOString().split('T')[0],
        אמצעי_תשלום: "מזומן",
        מספר_אסמכתא: "",
        הערות: ""
      });
      setShowAddPaymentDialog(false);
    },
  });

  const deletePaymentMutation = useMutation({ // New mutation for deleting payment records
    mutationFn: (id) => base44.entities.תשלום_חשבונית.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['תשלום_חשבונית'] });
      if (currentInvoiceForPayments) {
        await updateInvoicePaymentStatus(currentInvoiceForPayments);
      }
    },
  });

  const updateInvoicePaymentStatus = async (invoiceId) => { // New function to manage invoice's total paid and status
    await queryClient.invalidateQueries({ queryKey: ['תשלום_חשבונית'] });

    const allPayments = await base44.entities.תשלום_חשבונית.list();
    const invoicePayments = allPayments.filter(p => p.חשבונית_id === invoiceId);

    const totalPaid = invoicePayments.reduce((sum, p) => sum + (p.סכום_תשלום || 0), 0);

    const invoiceToUpdate = await base44.entities.חשבונית.get(invoiceId);
    if (!invoiceToUpdate) return;

    const totalAmount = invoiceToUpdate.סכום_כולל || 0;

    let newStatus = invoiceToUpdate.סטטוס; // Start with current status

    // Status logic for detailed payments
    if (newStatus === 'טיוטה') {
        if (totalAmount === 0) { // Draft with zero total is considered paid
            newStatus = 'שולמה';
        } else if (totalPaid > 0) { // Draft with payment moves to partial/paid
            newStatus = totalPaid >= totalAmount ? 'שולמה' : 'שולמה חלקית';
        } else if (totalAmount > 0) { // Draft with items and no payment moves to pending
             newStatus = 'ממתינה לתשלום';
        }
    } else { // If not a draft, status always reflects payment state
        if (totalAmount === 0) {
            newStatus = 'שולמה';
        } else if (totalPaid === 0 && totalAmount > 0) {
            newStatus = 'ממתינה לתשלום';
        } else if (totalPaid >= totalAmount) {
            newStatus = 'שולמה';
        } else if (totalPaid > 0 && totalPaid < totalAmount) {
            newStatus = 'שולמה חלקית';
        }
    }

    await base44.entities.חשבונית.update(invoiceId, {
      סכום_שולם: totalPaid,
      סטטוס: newStatus
    });

    queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
  };

  const recalculateInvoiceTotals = async (invoiceId) => {
    // Ensure invoice lines data is fresh
    await queryClient.invalidateQueries({ queryKey: ['שורת_חשבונית'] });

    const allLines = await base44.entities.שורת_חשבונית.list();
    const lines = allLines.filter(l => l.חשבונית_id === invoiceId);

    let total = 0;

    for (const line of lines) {
      if (line.סוג_שורה === 'זיכוי_מלאי') {
        continue;
      }

      const quantity = line.כמות || 0;
      const lineTotal = quantity * (line.מחיר_יחידה || 0) * (1 - (line.הנחה_אחוז || 0) / 100);
      total += lineTotal;
    }

    const vat = total * 0.18;
    const totalWithVat = total + vat;

    // Update the invoice's total amounts
    await base44.entities.חשבונית.update(invoiceId, {
      סכום_לפני_מעם: total,
      מעם: vat,
      סכום_כולל: totalWithVat,
    });

    queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
    // After updating the invoice's totals, update its payment status based on existing payments
    await updateInvoicePaymentStatus(invoiceId);
  };

  const resetForm = () => {
    setFormData({
      לקוח_id: "",
      טכנאי_id: "",
      מספר_דוח: "",
      מספר_493: "",
      תאריך: new Date().toISOString().split('T')[0],
      סטטוס: "טיוטה", // Reset to initial, will be managed
      סכום_שולם: 0, // Reset to initial, will be managed
      הערות: ""
    });
    setEditingInvoice(null);
    setCustomerSearch("");
  };

  const resetLineForm = () => {
    setLineItemForm({
      פריט_id: "",
      תיאור: "",
      כמות: 1,
      מחיר_יחידה: 0,
      הנחה_אחוז: 0,
      סוג_שורה: lineItemForm.סוג_שורה,
      מיון_שורות: 1,
      includeLinkedWorks: true
    });
    setWorkSearch("");
    setItemSearchText("");
    setCreditSearch("");
  };

  const handleFillSystemCodes = async () => {
    if (!confirm('האם למלא קודי מערכת לכל החשבוניות הקיימות?\nפעולה זו תתבצע רק עבור חשבוניות שאין להן קוד מערכת.')) {
      return;
    }

    setIsFillingCodes(true);
    try {
      const response = await base44.functions.invoke('fillSystemCodes', {});
      alert(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
    } catch (error) {
      alert('שגיאה: ' + error.message);
    } finally {
      setIsFillingCodes(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.לקוח_id) {
      alert("יש לבחור לקוח לחשבונית.");
      return;
    }

    if (editingInvoice) {
      // Exclude payment-related fields as they are now managed by the detailed payment system
      const { סכום_שולם, סטטוס, ...restFormData } = formData;
      updateInvoiceMutation.mutate({ id: editingInvoice.id, data: restFormData });
    } else {
      let nextSystemCode = 100000;
      if (invoices.length > 0) {
        const existingCodes = invoices
          .map(inv => parseInt(inv.קוד_מערכת))
          .filter(num => !isNaN(num));

        if (existingCodes.length > 0) {
          const maxCode = Math.max(...existingCodes);
          nextSystemCode = maxCode + 1;
        }
      }

      const systemCode = nextSystemCode.toString();

      const dataToSubmit = {
        ...formData,
        קוד_מערכת: systemCode,
        מספר_חשבונית: "", // לא מייצרים מספר חשבונית בשלב היצירה
        סכום_לפני_מעם: 0,
        מעם: 0,
        סכום_כולל: 0,
        סכום_שולם: 0,
        סטטוס: "טיוטה"
      };
      createInvoiceMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    const customer = customers.find(c => c.id === invoice.לקוח_id);
    setCustomerSearch(customer ? customer.שם_לקוח : "");
    setFormData({
      לקוח_id: invoice.לקוח_id,
      טכנאי_id: invoice.טכנאי_id || "",
      מספר_דוח: invoice.מספר_דוח || "",
      מספר_493: invoice.מספר_493 || "",
      תאריך: invoice.תאריך,
      // סטטוס and סכום_שולם are now managed by payment system, not directly editable here
      הערות: invoice.הערות || ""
    });
    setIsDialogOpen(true);
  };

  const handleManageLines = async (invoiceId) => {
    setCurrentInvoiceId(invoiceId);
    setShowLineItems(true);
    setLocalLineSorts({});
    await recalculateInvoiceTotals(invoiceId);
  };

  const handleApplySorting = () => {
    const updates = Object.entries(localLineSorts).map(([id, sortValue]) => ({
      id,
      data: { מיון_שורות: sortValue }
    }));

    if (updates.length > 0) {
      bulkUpdateLinesMutation.mutate(updates);
    }
  };

  const handleLocalSortChange = (lineId, newSort) => {
    setLocalLineSorts(prev => ({
      ...prev,
      [lineId]: newSort
    }));
  };

  const getLineSort = (line) => {
    return localLineSorts[line.id] ?? line.מיון_שורות ?? 1;
  };

  const handleAddLine = async (e) => {
    e.preventDefault();

    if (!lineItemForm.תיאור.trim()) {
      alert("תיאור השורה לא יכול להיות ריק.");
      return;
    }

    if (lineItemForm.מחיר_יחידה === "" || lineItemForm.מחיר_יחידה === null || lineItemForm.מחיר_יחידה === undefined) {
      alert("יש להזין מחיר יחידה.");
      return;
    }

    const lineTotal = (parseFloat(lineItemForm.כמות) || 0) * (parseFloat(lineItemForm.מחיר_יחידה) || 0) * (1 - ((parseFloat(lineItemForm.הנחה_אחוז) || 0) / 100));

    const linesToCreate = [];

    linesToCreate.push({
      חשבונית_id: currentInvoiceId,
      פריט_id: lineItemForm.פריט_id || null,
      תיאור: lineItemForm.תיאור,
      כמות: parseFloat(lineItemForm.כמות) || 1,
      מחיר_יחידה: parseFloat(lineItemForm.מחיר_יחידה) || 0,
      הנחה_אחוז: parseFloat(lineItemForm.הנחה_אחוז) || 0,
      סוג_שורה: lineItemForm.סוג_שורה,
      מיון_שורות: parseFloat(lineItemForm.מיון_שורות) || 1,
      סכום_שורה: lineTotal
    });

    const selectedItem = lineItemForm.פריט_id ? items.find(i => i.id === lineItemForm.פריט_id) : null;
    const hasLinkedWorks = selectedItem &&
                          selectedItem.עבודות_מקושרות &&
                          selectedItem.עבודות_מקושרות.length > 0 &&
                          lineItemForm.סוג_שורה === 'פריט' &&
                          globalIncludeLinkedWorks;

    if (hasLinkedWorks) {
      const linkedWorkItems = items.filter(i =>
        selectedItem.עבודות_מקושרות.includes(i.id)
      );

      if (linkedWorkItems.length > 0) {
        linkedWorkItems.forEach((linkedWorkItem, index) => {
          const workLineTotal = (parseFloat(lineItemForm.כמות) || 0) * (parseFloat(linkedWorkItem.מחיר_מכירה) || 0);
          linesToCreate.push({
            חשבונית_id: currentInvoiceId,
            פריט_id: linkedWorkItem.id,
            תיאור: linkedWorkItem.שם_פריט,
            כמות: parseFloat(lineItemForm.כמות) || 1,
            מחיר_יחידה: parseFloat(linkedWorkItem.מחיר_מכירה) || 0,
            הנחה_אחוז: 0,
            סוג_שורה: 'עבודה',
            מיון_שורות: (parseFloat(lineItemForm.מיון_שורות) || 1) + 0.01 * (index + 1),
            סכום_שורה: workLineTotal
          });
        });
      }
    }

    try {
      for (const lineData of linesToCreate) {
        await createLineMutation.mutateAsync(lineData);
      }
      await recalculateInvoiceTotals(currentInvoiceId);
      resetLineForm();
    } catch (error) {
      console.error("נכשלה הוספת שורות:", error);
      alert("נכשלה הוספת שורות: " + error.message);
    }
  };

  const generateInvoiceNumber = async (invoiceId) => {
    let nextInvoiceNumber = 7527;
    if (invoices.length > 0) {
      const existingNumbers = invoices
        .map(inv => parseInt(inv.מספר_חשבונית))
        .filter(num => !isNaN(num));

      if (existingNumbers.length > 0) {
        const maxNumber = Math.max(...existingNumbers);
        nextInvoiceNumber = maxNumber + 1;
      }
    }

    const invoiceNumber = nextInvoiceNumber.toString();
    await base44.entities.חשבונית.update(invoiceId, { מספר_חשבונית: invoiceNumber });
    await queryClient.invalidateQueries({ queryKey: ['חשבונית'] });
    return invoiceNumber;
  };

  const checkAnd493BeforePrint = async (invoiceId, action) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    // בודק אם יש מספר חשבונית, אם לא - מייצר
    if (!invoice.מספר_חשבונית) {
      await generateInvoiceNumber(invoiceId);
    }

    // בודק אם יש מספר 493, אם לא - מבקש
    const updatedInvoice = invoices.find(inv => inv.id === invoiceId);
    if (!updatedInvoice?.מספר_493) {
      setPending493Invoice(invoiceId);
      setPending493Action(action);
      setNum493Input("");
      setShow493Dialog(true);
    } else {
      executePrintAction(invoiceId, action);
    }
  };

  const executePrintAction = async (invoiceId, action) => {
    let functionName;
    if (action === 'invoice') functionName = 'renderInvoicePrintView';
    else if (action === 'materials') functionName = 'renderMaterialsReport';
    else if (action === 'both') functionName = 'renderCombinedPrintView';

    const response = await base44.functions.invoke(functionName, { invoiceId });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(response.data);
    printWindow.document.close();
  };

  const handleConfirm493 = async () => {
    if (!num493Input || num493Input.trim() === "") {
      alert("יש להזין מספר 493");
      return;
    }

    await base44.entities.חשבונית.update(pending493Invoice, { מספר_493: num493Input });
    await queryClient.invalidateQueries({ queryKey: ['חשבונית'] });

    setShow493Dialog(false);
    executePrintAction(pending493Invoice, pending493Action);
  };

  const handlePrint = async (invoiceId) => {
    checkAnd493BeforePrint(invoiceId, 'invoice');
  };

  const handlePrintMaterials = async (invoiceId) => {
    checkAnd493BeforePrint(invoiceId, 'materials');
  };

  const handlePrintBoth = async (invoiceId) => {
    checkAnd493BeforePrint(invoiceId, 'both');
  };

  const handlePrintDraft = async (invoiceId) => {
    // הדפסת טיוטה ללא בדיקות של מספר חשבונית או 493
    executePrintAction(invoiceId, 'both');
  };

  const generateInvoicePDF = async (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const customer = customers.find(c => c.id === invoice.לקוח_id);
    const technician = technicians.find(t => t.id === invoice.טכנאי_id);
    
    const allLines = invoiceLines.filter(l => l.חשבונית_id === invoiceId);
    const workLines = allLines.filter(l => l.סוג_שורה === 'עבודה').sort((a, b) => {
      if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
        return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
      }
      return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    });
    const itemLines = allLines.filter(l => l.סוג_שורה === 'פריט').sort((a, b) => {
      if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
        return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
      }
      return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    });
    const creditLines = allLines.filter(l => l.סוג_שורה === 'זיכוי_מלאי').sort((a, b) => {
      if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
        return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
      }
      return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
    });

    let laborSubtotal = 0;
    workLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      laborSubtotal += lineTotal;
    });
    
    let itemsSubtotal = 0;
    itemLines.forEach(line => {
      const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
      itemsSubtotal += lineTotal;
    });
    
    const laborVat = laborSubtotal * 0.18;
    const laborTotal = laborSubtotal + laborVat;
    const itemsVat = itemsSubtotal * 0.18;

    const invoiceDate = format(new Date(invoice.תאריך), 'dd/MM/yyyy');

    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.right = '-9999px';
    container.style.width = '210mm';
    container.style.background = 'white';
    container.style.direction = 'rtl';
    document.body.appendChild(container);

    container.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 15px; background: white; color: #000; direction: rtl;">
        <div style="max-width: 900px; margin: 0 auto; background: white; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; font-size: 12px;">
            <div style="border: 2px solid #000; padding: 5px 8px; text-align: center; line-height: 1.3; width: 160px;">
              <div>טכנאי גז רמת 2</div>
              <div>מס' ההסמכה ${technician?.מספר_הסמכה || '1254'}</div>
            </div>
            <div style="font-size: 16px; font-weight: bold; padding-top: 20px;">העתק</div>
            <div style="border: 2px solid #000; padding: 5px 8px; text-align: center; line-height: 1.3; width: 160px;">
              <div>עוסק מורשה למע"מ</div>
              <div>מס' 056510639</div>
            </div>
          </div>
          
          <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 36px; font-weight: bold; color: #ff0000; letter-spacing: 2px; margin-bottom: 3px;">בן שלום שאלתיאל</div>
            <div style="font-size: 16px; color: #ff0000; margin-bottom: 6px;">טכנאי גז ותיקונים</div>
          </div>
          
          <div style="border: 2px solid #000; padding: 5px; text-align: center; font-size: 12px; margin-bottom: 12px;">
            רח' לוז 31 נחלת יהודה ראשון לציון טל. 054-7252776
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 14px;">${invoiceDate}</div>
            <div style="font-size: 20px; font-weight: bold;">חשבון מספר ${invoice.מספר_חשבונית || '0'}</div>
          </div>
          
          <div style="margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 6px;">
            <div style="display: flex; border-bottom: 2px solid #000; padding: 3px 0; font-size: 13px;">
              <span style="font-weight: bold; margin-left: 10px; min-width: 70px;">לכבוד</span>
              <span>אמישרא גז</span>
            </div>
            <div style="display: flex; padding: 3px 0; font-size: 13px;">
              <span style="font-weight: bold; margin-left: 10px; min-width: 70px;">כתובת:</span>
              <span>אחד העם 34 תל אביב</span>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 2px solid #000;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 10%;">כמות</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 60%;">פריטים</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 15%;">מחיר יח'</th>
                <th style="border: 2px solid #000; padding: 5px 6px; text-align: center; font-size: 12px; background: #fff; font-weight: bold; width: 15%;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${workLines.map(line => {
                const lineTotal = (line.כמות || 0) * (line.מחיר_יחידה || 0) * (1 - ((line.הנחה_אחוז || 0) / 100));
                return `
                <tr>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.כמות || ''}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: right; padding-right: 10px; font-size: 12px;">${line.תיאור}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${line.מחיר_יחידה?.toFixed(2) || '0.00'}</td>
                  <td style="border: 2px solid #000; padding: 4px 6px; text-align: center; font-size: 12px;">${lineTotal.toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: start;">
            <div style="text-align: right; font-size: 14px; line-height: 1.8;">
              <div>מרכזייה\\צרכן${customer?.שם_לקוח ? `: ${customer.שם_לקוח}` : ''}</div>
              ${customer?.כתובת ? `<div>כתובת: ${customer.כתובת}</div>` : ''}
              ${invoice.מספר_דוח ? `<div>מספר עבודה: ${invoice.מספר_דוח}</div>` : ''}
              ${invoice.מספר_493 ? `<div>493: ${invoice.מספר_493}</div>` : ''}
              ${itemsSubtotal > 0 ? `<div>סה"כ חומר: ₪${itemsSubtotal.toFixed(2)}</div>` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${itemsSubtotal > 0 ? '5px' : '10px'};">
                ${invoice.קוד_מערכת ? `<div style="font-weight: bold; color: #666;">קוד מערכת: ${invoice.קוד_מערכת}</div>` : '<div></div>'}
                <div style="text-align: left; margin-right: 20px;">חתימת העוסק המורשה: _________________</div>
              </div>
            </div>
            
            <table style="width: 350px; border: 2px solid #000; border-collapse: collapse;">
              <tr>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">סה"כ</td>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborSubtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">מע"מ בשיעור 18%</td>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborVat.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: right;">סכום כולל מע"מ</td>
                <td style="border: 2px solid #000; padding: 8px 12px; font-size: 14px; text-align: center; font-weight: bold;">₪${laborTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: container.scrollWidth + 100,
        windowHeight: container.scrollHeight + 100,
        x: -20,
        y: -20
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = pdf.internal.pageSize.getHeight() - 20;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`חשבון-${invoice.מספר_חשבונית || invoice.קוד_מערכת}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('שגיאה ביצירת PDF');
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('ניתן להעלות רק קבצי PDF');
      e.target.value = null;
      return;
    }

    if (!documentForm.description.trim()) {
      alert('נא להזין תיאור למסמך');
      return;
    }

    setUploadingFile(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

      await createDocumentMutation.mutateAsync({
        חשבונית_id: currentInvoiceId,
        file_uri: file_uri,
        fileName: file.name,
        description: documentForm.description,
        תאריך_מסמך: documentForm.תאריך_מסמך
      });

      e.target.value = null;
      alert('המסמך הועלה בהצלחה');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('שגיאה בהעלאת המסמך: ' + error.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleViewDocument = async (doc) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: doc.file_uri,
        expires_in: 3600
      });
      window.open(signed_url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('שגיאה בפתיחת המסמך: ' + error.message);
    }
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: doc.file_uri,
        expires_in: 3600
      });

      const a = document.createElement('a');
      a.href = signed_url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('שגיאה בהורדת המסמך: ' + error.message);
    }
  };

  const handleManagePayments = (invoice) => { // New function to open payment management dialog
    setCurrentInvoiceForPayments(invoice.id);
    setShowPaymentsDialog(true);
  };

  const handleAddPayment = async (e) => { // New function to handle adding a new payment
    e.preventDefault();

    if (!paymentForm.סכום_תשלום || parseFloat(paymentForm.סכום_תשלום) <= 0) {
      alert('יש להזין סכום תשלום חיובי');
      return;
    }

    await createPaymentMutation.mutateAsync({
      חשבונית_id: currentInvoiceForPayments,
      סכום_תשלום: parseFloat(paymentForm.סכום_תשלום),
      תאריך_תשלום: paymentForm.תאריך_תשלום,
      אמצעי_תשלום: paymentForm.אמצעי_תשלום,
      מספר_אסמכתא: paymentForm.מספר_אסמכתא,
      הערות: paymentForm.הערות
    });
  };

  const calculateRemaining = (invoice) => {
    return (invoice.סכום_כולל || 0) - (invoice.סכום_שולם || 0);
  };

  const getCustomerName = (id) => customers.find(c => c.id === id)?.שם_לקוח || '-';
  const getTechnicianName = (id) => technicians.find(t => t.id === id)?.שם_טכנאי || '-';

  const currentInvoiceLines = invoiceLines
    .filter(l => l.חשבונית_id === currentInvoiceId)
    .sort((a, b) => {
      if ((a.מיון_שורות || 1) !== (b.מיון_שורות || 1)) {
        return (a.מיון_שורות || 1) - (b.מיון_שורות || 1);
      }
      return new Date(a.created_date) - new Date(b.created_date);
    });

  const calculateCurrentTotals = () => {
    let subtotal = 0;
    currentInvoiceLines.forEach(line => {
      if (line.סוג_שורה === 'זיכוי_מלאי') {
        return;
      }

      const quantity = line.כמות || 0;
      const lineTotal = quantity * (line.מחיר_יחידה || 0) * (1 - (line.הנחה_אחוז || 0) / 100);
      subtotal += lineTotal;
    });
    const vat = subtotal * 0.18;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const currentTotals = calculateCurrentTotals();

  const getInvoicePayments = (invoiceId) => { // Helper to filter payments for an invoice
    return payments
      .filter(p => p.חשבונית_id === invoiceId)
      .sort((a, b) => new Date(b.תאריך_תשלום) - new Date(a.תאריך_תשלום));
  };

  const currentInvoicePayments = currentInvoiceForPayments ? getInvoicePayments(currentInvoiceForPayments) : [];
  const currentInvoice = currentInvoiceForPayments ? invoices.find(inv => inv.id === currentInvoiceForPayments) : null;


  const statusColors = {
    "טיוטה": "bg-gray-100 text-gray-800",
    "ממתינה לתשלום": "bg-orange-100 text-orange-800",
    "שולמה חלקית": "bg-yellow-100 text-yellow-800",
    "שולמה": "bg-green-100 text-green-800"
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const customerName = getCustomerName(invoice.לקוח_id);
    const technicianName = getTechnicianName(invoice.טכנאי_id);
    const date = format(new Date(invoice.תאריך), 'dd/MM/yyyy');

    return (
      invoice.מספר_חשבונית?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.קוד_מערכת && String(invoice.קוד_מערכת).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (invoice.מספר_493 && String(invoice.מספר_493).toLowerCase().includes(searchTerm.toLowerCase())) ||
      invoice.מספר_דוח?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      date.includes(searchTerm) ||
      invoice.סטטוס?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.הערות?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getSortedInvoices = () => {
    const sorted = [...filteredInvoices].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'קוד_מערכת':
          aVal = parseInt(a.קוד_מערכת) || 0;
          bVal = parseInt(b.קוד_מערכת) || 0;
          break;
        case 'מספר_חשבונית':
          aVal = parseInt(a.מספר_חשבונית) || 0;
          bVal = parseInt(b.מספר_חשבונית) || 0;
          break;
        case 'מספר_493':
          aVal = parseInt(a.מספר_493) || 0;
          bVal = parseInt(b.מספר_493) || 0;
          break;
        case 'מספר_דוח':
          aVal = a.מספר_דוח || '';
          bVal = b.מספר_דוח || '';
          break;
        case 'לקוח':
          aVal = getCustomerName(a.לקוח_id);
          bVal = getCustomerName(b.לקוח_id);
          break;
        case 'טכנאי':
          aVal = getTechnicianName(a.טכנאי_id);
          bVal = getTechnicianName(b.טכנאי_id);
          break;
        case 'תאריך':
          aVal = new Date(a.תאריך);
          bVal = new Date(b.תאריך);
          break;
        case 'סכום':
          aVal = a.סכום_כולל || 0;
          bVal = b.סכום_כולל || 0;
          break;
        case 'סטטוס':
          aVal = a.סטטוס || '';
          bVal = b.סטטוס || '';
          break;
        case 'created_date':
        default:
          aVal = new Date(a.created_date);
          bVal = new Date(b.created_date);
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal, 'he') : bVal.localeCompare(aVal, 'he');
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return sorted;
  };

  const currentDisplayedInvoices = getSortedInvoices();
  const currentInvoiceDocuments = documents.filter(d => d.חשבונית_id === currentInvoiceId);

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 md:w-8 md:h-8" />
              ניהול חשבון
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">רשימת כל החשבונות במערכת</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleFillSystemCodes}
              disabled={isFillingCodes}
              variant="outline"
              className="text-sm"
            >
              <RefreshCw className={`w-4 h-4 ml-2 ${isFillingCodes ? 'animate-spin' : ''}`} />
              {isFillingCodes ? 'ממלא קודים...' : 'מלא קודי מערכת'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto text-sm md:text-base" onClick={resetForm}>
                  <Plus className="w-4 h-4 ml-2" />
                  חשבון חדש
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingInvoice ? 'עריכת חשבון' : 'חשבון חדש'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>לקוח *</Label>
                    <Select
                      value={formData.לקוח_id || ""}
                      onValueChange={(value) => {
                        const customer = customers.find(c => c.id === value);
                        setFormData({
                          ...formData,
                          לקוח_id: value,
                          מספר_דוח: customer?.מספר_הוראת_עבודה || formData.מספר_דוח
                        });
                        setCustomerSearch(customer ? customer.שם_לקוח : "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר לקוח" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <div className="sticky top-0 bg-white p-2 border-b">
                          <Input
                            placeholder="🔍 חפש לקוח..."
                            value={customerSearch}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCustomerSearch(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                          />
                        </div>
                        <div className="p-1">
                          {customers
                            .filter(c => {
                              const searchTermLower = customerSearch.toLowerCase();
                              if (!searchTermLower) return true;

                              const nameMatch = c.שם_לקוח?.toLowerCase().startsWith(searchTermLower);
                              const phoneMatch = c.טלפון?.includes(customerSearch);
                              const merkeziyaMatch = c.מספר_מרכזייה_צרכן?.includes(customerSearch);
                              const addressMatch = c.כתובת?.toLowerCase().includes(searchTermLower);
                              const workOrderMatch = c.מספר_הוראת_עבודה?.includes(searchTermLower);

                              return nameMatch || phoneMatch || merkeziyaMatch || addressMatch || workOrderMatch;
                            })
                            .sort((a, b) => {
                              if (!customerSearch) {
                                return new Date(b.created_date) - new Date(a.created_date);
                              }
                              return (a.שם_לקוח || '').localeCompare(b.שם_לקוח || '', 'he');
                            })
                            .slice(0, 50)
                            .map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.שם_לקוח}
                              </SelectItem>
                            ))}
                          {customers.filter(c => {
                            const searchTermLower = customerSearch.toLowerCase();
                            if (!searchTermLower) return false;

                            const nameMatch = c.שם_לקוח?.toLowerCase().startsWith(searchTermLower);
                            const phoneMatch = c.טלפון?.includes(customerSearch);
                            const merkeziyaMatch = c.מספר_מרכזייה_צרכן?.includes(customerSearch);
                            const addressMatch = c.כתובת?.toLowerCase().includes(searchTermLower);
                            const workOrderMatch = c.מספר_הוראת_עבודה?.includes(searchTermLower);
                            return nameMatch || phoneMatch || merkeziyaMatch || addressMatch || workOrderMatch;
                          }).length === 0 && customerSearch && (
                            <div className="text-sm text-gray-500 text-center py-4">
                              לא נמצאו לקוחות תואמים
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>טכנאי</Label>
                    <Select value={formData.טכנאי_id || ""} onValueChange={(value) => setFormData({...formData, טכנאי_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר טכנאי (אופציונלי)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>ללא טכנאי</SelectItem>
                        {technicians.filter(t => t.פעיל).map((technician) => (
                          <SelectItem key={technician.id} value={technician.id}>
                            {technician.שם_טכנאי}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>הוראת עבודה</Label>
                    <Input
                      value={formData.מספר_דוח}
                      onChange={(e) => setFormData({...formData, מספר_דוח: e.target.value})}
                      placeholder="למשל: 877787"
                    />
                    <p className="text-xs text-gray-500 mt-1">מספר הוראת העבודה של החברה (יופיע בהדפסה)</p>
                  </div>
                  <div>
                    <Label>493</Label>
                    <Input
                      type="number"
                      value={formData.מספר_493}
                      onChange={(e) => setFormData({...formData, מספר_493: e.target.value})}
                      placeholder="הזן מספר 493 (אופציונלי)"
                    />
                    <p className="text-xs text-gray-500 mt-1">מספר 493 - אופציונלי, ניתן להזין בעת הדפסה</p>
                  </div>
                  <div>
                    <Label>תאריך הפקת חשבון *</Label>
                    <Input
                      type="date"
                      value={formData.תאריך}
                      onChange={(e) => setFormData({...formData, תאריך: e.target.value})}
                      required
                      className="text-right"
                    />
                    {formData.תאריך && (
                      <p className="text-xs text-blue-600 mt-1">
                        {new Date(formData.תאריך).toLocaleDateString('he-IL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long'
                        })}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">בחר את התאריך שבו הופקה החשבון</p>
                  </div>
                  {/* Removed Status and סכום_שולם inputs from main edit form as they are now managed by payment system */}
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
                      {editingInvoice ? 'עדכן' : 'צור חשבון'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* New 'דיאלוג ניהול תשלומים' component */}
        <Dialog open={showPaymentsDialog} onOpenChange={setShowPaymentsDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                ניהול תשלומים - חשבון #{currentInvoice?.מספר_חשבונית}
              </DialogTitle>
            </DialogHeader>

            {currentInvoice && (
              <div className="space-y-4">
                {/* סיכום החשבונית */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">סה"כ לתשלום</div>
                      <div className="text-lg font-bold text-gray-900">
                        ₪{currentInvoice.סכום_כולל?.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">שולם</div>
                      <div className="text-lg font-bold text-green-600">
                        ₪{currentInvoice.סכום_שולם?.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">יתרה</div>
                      <div className="text-lg font-bold text-orange-600">
                        ₪{calculateRemaining(currentInvoice).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* כפתור הוספת תשלום */}
                <Button
                  onClick={() => setShowAddPaymentDialog(true)}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={calculateRemaining(currentInvoice) <= 0 && currentInvoice.סכום_כולל > 0} // Disable if fully paid and not zero total
                >
                  <Plus className="w-4 h-4 ml-2" />
                  רשום תשלום חדש
                </Button>

                {/* רשימת תשלומים */}
                <div>
                  <h3 className="font-semibold mb-3">תשלומים שבוצעו ({currentInvoicePayments.length})</h3>

                  {currentInvoicePayments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
                      <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>אין תשלומים רשומים</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentInvoicePayments.map((payment) => (
                        <div key={payment.id} className="border rounded-lg p-3 bg-white hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="text-xl font-bold text-green-600">
                                  ₪{payment.סכום_תשלום?.toFixed(2)}
                                </div>
                                <Badge className="bg-blue-100 text-blue-800">
                                  {payment.אמצעי_תשלום}
                                </Badge>
                              </div>
                              <div className="flex gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(payment.תאריך_תשלום), 'dd/MM/yyyy')}
                                </div>
                                {payment.מספר_אסמכתא && (
                                  <div>אסמכתא: {payment.מספר_אסמכתא}</div>
                                )}
                              </div>
                              {payment.הערות && (
                                <div className="text-sm text-gray-500 mt-1">{payment.הערות}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('האם למחוק תשלום זה?')) {
                                  deletePaymentMutation.mutate(payment.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="מחק תשלום"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowPaymentsDialog(false)}>
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog for 493 input */}
        <Dialog open={show493Dialog} onOpenChange={setShow493Dialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>הזן מספר 493</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>מספר 493 *</Label>
                <Input
                  type="number"
                  value={num493Input}
                  onChange={(e) => setNum493Input(e.target.value)}
                  placeholder="הזן מספר 493"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">מספר 493 נדרש להדפסה</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShow493Dialog(false)}
                >
                  ביטול
                </Button>
                <Button 
                  onClick={handleConfirm493}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  המשך להדפסה
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New 'דיאלוג הוספת תשלום' component */}
        <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>רישום תשלום חדש</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <Label>סכום התשלום *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.סכום_תשלום}
                  onChange={(e) => setPaymentForm({...paymentForm, סכום_תשלום: e.target.value})}
                  placeholder="0.00"
                  required
                  autoFocus
                />
                {currentInvoice && (
                  <p className="text-xs text-gray-500 mt-1">
                    יתרה לתשלום: ₪{calculateRemaining(currentInvoice).toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <Label>תאריך התשלום *</Label>
                <Input
                  type="date"
                  value={paymentForm.תאריך_תשלום}
                  onChange={(e) => setPaymentForm({...paymentForm, תאריך_תשלום: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>אמצעי תשלום *</Label>
                <Select
                  value={paymentForm.אמצעי_תשלום}
                  onValueChange={(value) => setPaymentForm({...paymentForm, אמצעי_תשלום: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="מזומן">מזומן</SelectItem>
                    <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                    <SelectItem value="צ'ק">צ'ק</SelectItem>
                    <SelectItem value="כרטיס אשראי">כרטיס אשראי</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>מספר אסמכתא / צ'ק</Label>
                <Input
                  value={paymentForm.מספר_אסמכתא}
                  onChange={(e) => setPaymentForm({...paymentForm, מספר_אסמכתא: e.target.value})}
                  placeholder="אופציונלי"
                />
              </div>

              <div>
                <Label>הערות</Label>
                <Textarea
                  value={paymentForm.הערות}
                  onChange={(e) => setPaymentForm({...paymentForm, הערות: e.target.value})}
                  placeholder="הערות על התשלום (אופציונלי)"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
                  ביטול
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  שמור תשלום
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* דיאלוג ניהול מסמכים */}
        <Dialog open={showDocumentsDialog} onOpenChange={setShowDocumentsDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                מסמכים מצורפים לחשבון
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* טופס העלאת מסמך */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-3">העלאת מסמך חדש</h3>
                <div className="space-y-3">
                  <div>
                    <Label>תיאור המסמך *</Label>
                    <Input
                      value={documentForm.description}
                      onChange={(e) => setDocumentForm({...documentForm, description: e.target.value})}
                      placeholder="לדוגמה: חשבונית מקורית, אישור תשלום..."
                      required
                    />
                  </div>

                  <div>
                    <Label>תאריך המסמך *</Label>
                    <Input
                      type="date"
                      value={documentForm.תאריך_מסמך}
                      onChange={(e) => setDocumentForm({...documentForm, תאריך_מסמך: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label>בחר קובץ PDF *</Label>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                    {uploadingFile && (
                      <p className="text-sm text-blue-600 mt-2">מעלה קובץ...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* רשימת מסמכים */}
              <div>
                <h3 className="font-semibold mb-3">מסמכים קיימים ({currentInvoiceDocuments.length})</h3>
                {currentInvoiceDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>אין מסמכים מצורפים</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentInvoiceDocuments.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-3 bg-white hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-red-600" />
                              <span className="font-medium">{doc.fileName}</span>
                            </div>
                            {doc.description && (
                              <p className="text-sm text-gray-600 mb-1">{doc.description}</p>
                            )}
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>תאריך: {format(new Date(doc.תאריך_מסמך), 'dd/MM/yyyy')}</span>
                              <span>הועלה: {format(new Date(doc.created_date), 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDocument(doc)}
                              title="צפה במסמך"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadDocument(doc)}
                              title="הורד מסמך"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('האם למחוק את המסמך?')) {
                                  deleteDocumentMutation.mutate(doc.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="מחק מסמך"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowDocumentsDialog(false)}>
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLineItems} onOpenChange={setShowLineItems}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול שורות חשבון</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddLine} className="border-b pb-4 mb-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                <input
                  type="checkbox"
                  id="globalIncludeLinkedWorks"
                  checked={globalIncludeLinkedWorks}
                  onChange={(e) => setGlobalIncludeLinkedWorks(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="globalIncludeLinkedWorks" className="cursor-pointer font-medium">
                  כלול עבודות מקושרות לפריטים
                </Label>
              </div>
              <Tabs defaultValue="work" className="w-full mb-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="work"
                    onClick={() => {
                      setLineItemForm({...lineItemForm, סוג_שורה: "עבודה", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1});
                      setWorkSearch("");
                    }}
                  >
                    עבודה
                  </TabsTrigger>
                  <TabsTrigger
                    value="item"
                    onClick={() => {
                      setLineItemForm({...lineItemForm, סוג_שורה: "פריט", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1});
                      setItemSearchText("");
                    }}
                  >
                    פריט
                  </TabsTrigger>
                  <TabsTrigger
                    value="credit"
                    onClick={() => {
                      setLineItemForm({...lineItemForm, סוג_שורה: "זיכוי_מלאי", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1});
                      setCreditSearch("");
                    }}
                  >
                    חומרים לזיכוי מלאי
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="work" className="mt-3">
                  <div className="space-y-3">
                    <div>
                      <Label>בחר עבודה (אופציונלי)</Label>
                      <Select
                        value={lineItemForm.פריט_id || ""}
                        onValueChange={(value) => {
                          if (value) {
                            const item = items.find(i => i.id === value);
                            if (item) {
                              setLineItemForm({
                                ...lineItemForm,
                                פריט_id: value,
                                תיאור: item.שם_פריט,
                                מחיר_יחידה: item.מחיר_מכירה,
                                סוג_שורה: "עבודה"
                              });
                              setWorkSearch("");
                            }
                          } else {
                            setLineItemForm({
                              ...lineItemForm,
                              פריט_id: "",
                              תיאור: "",
                              מחיר_יחידה: 0,
                              סוג_שורה: "עבודה"
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר עבודה או הזן ידנית" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <Input
                              placeholder=""
                              value={workSearch}
                              onChange={(e) => {
                                e.stopPropagation();
                                setWorkSearch(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-8"
                            />
                          </div>
                          <div className="p-1">
                            <SelectItem value={null}>ללא - הזנה ידנית</SelectItem>
                            {items
                              .filter(i => i.פעיל && i.סוג_פריט === 'עבודה')
                              .filter(i => {
                                if (!workSearch) return true;
                                const search = workSearch.toLowerCase().trim();
                                const name = (i.שם_פריט || '').toLowerCase();
                                const catalog = (i.מספר_קטלוג || '').toLowerCase();
                                const desc = (i.תיאור || '').toLowerCase();

                                return name.includes(search) || catalog.includes(search) || desc.includes(search);
                              })
                              .map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  <div className="flex flex-col items-start">
                                    <div className="font-medium">{item.שם_פריט}</div>
                                    <div className="text-xs text-gray-500">
                                      {item.מספר_קטלוג && `קטלוג: ${item.מספר_קטלוג} | `}
                                      ₪{item.מחיר_מכירה?.toFixed(2)}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            {items.filter(i => i.פעיל && i.סוג_פריט === 'עבודה').filter(i => {
                              if (!workSearch) return false;
                              const search = workSearch.toLowerCase().trim();
                              const name = (i.שם_פריט || '').toLowerCase();
                              const catalog = (i.מספר_קטלוג || '').toLowerCase();
                              const desc = (i.תיאור || '').toLowerCase();

                              return name.includes(search) || catalog.includes(search) || desc.includes(search);
                            }).length === 0 && workSearch && (
                              <div className="text-sm text-gray-500 text-center py-4">
                                לא נמצאו עבודות תואמות
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>תיאור העבודה *</Label>
                      <Textarea
                        value={lineItemForm.תיאור}
                        onChange={(e) => setLineItemForm({...lineItemForm, תיאור: e.target.value})}
                        placeholder="הזן תיאור העבודה"
                        required
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>כמות *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={lineItemForm.כמות}
                          onChange={(e) => setLineItemForm({...lineItemForm, כמות: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>מחיר ליחידה *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lineItemForm.מחיר_יחידה}
                          onChange={(e) => setLineItemForm({...lineItemForm, מחיר_יחידה: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>הנחה %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={lineItemForm.הנחה_אחוז}
                          onChange={(e) => setLineItemForm({...lineItemForm, הנחה_אחוז: e.target.value})}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף עבודה
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="item" className="mt-3">
                  <div className="space-y-3">
                    <div>
                      <Label>בחר פריט (אופציונלי)</Label>
                      <Select
                        value={lineItemForm.פריט_id || ""}
                        onValueChange={(value) => {
                          if (value) {
                            const item = items.find(i => i.id === value);
                            if (item) {
                              setLineItemForm({
                                ...lineItemForm,
                                פריט_id: value,
                                תיאור: item.שם_פריט,
                                מחיר_יחידה: item.מחיר_מכירה,
                                סוג_שורה: "פריט"
                              });
                              setItemSearchText("");
                            }
                          } else {
                            setLineItemForm({
                              ...lineItemForm,
                              פריט_id: "",
                              תיאור: "",
                              מחיר_יחידה: 0,
                              סוג_שורה: "פריט"
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר פריט או הזן ידנית" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <Input
                              placeholder=""
                              value={itemSearchText}
                              onChange={(e) => {
                                e.stopPropagation();
                                setItemSearchText(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-8"
                            />
                          </div>
                          <div className="p-1">
                            <SelectItem value={null}>ללא - הזנה ידנית</SelectItem>
                            {items
                              .filter(i => i.פעיל && i.סוג_פריט === 'פריט')
                              .filter(i => {
                                if (!itemSearchText) return true;
                                const search = itemSearchText.toLowerCase().trim();
                                const name = (i.שם_פריט || '').toLowerCase();
                                const catalog = (i.מספר_קטלוג || '').toLowerCase();
                                const desc = (i.תיאור || '').toLowerCase();

                                return name.includes(search) || catalog.includes(search) || desc.includes(search);
                              })
                              .map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  <div className="flex flex-col items-start">
                                    <div className="font-medium">{item.שם_פריט}</div>
                                    <div className="text-xs text-gray-500">
                                      {item.מספר_קטלוג && `קטלוג: ${item.מספר_קטלוג} | `}
                                      ₪{item.מחיר_מכירה?.toFixed(2)}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            {items.filter(i => i.פעיל && i.סוג_פריט === 'פריט').filter(i => {
                              if (!itemSearchText) return false;
                              const search = itemSearchText.toLowerCase().trim();
                              const name = (i.שם_פריט || '').toLowerCase();
                              const catalog = (i.מספר_קטלוג || '').toLowerCase();
                              const desc = (i.תיאור || '').toLowerCase();

                              return name.includes(search) || catalog.includes(search) || desc.includes(search);
                            }).length === 0 && itemSearchText && (
                              <div className="text-sm text-gray-500 text-center py-4">
                                לא נמצאו פריטים תואמים
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>תיאור הפריט *</Label>
                      <Textarea
                        value={lineItemForm.תיאור}
                        onChange={(e) => setLineItemForm({...lineItemForm, תיאור: e.target.value})}
                        placeholder="הזן תיאור הפריט"
                        required
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>כמות *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={lineItemForm.כמות}
                          onChange={(e) => setLineItemForm({...lineItemForm, כמות: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>מחיר ליחידה *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lineItemForm.מחיר_יחידה}
                          onChange={(e) => setLineItemForm({...lineItemForm, מחיר_יחידה: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>הנחה %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={lineItemForm.הנחה_אחוז}
                          onChange={(e) => setLineItemForm({...lineItemForm, הנחה_אחוז: e.target.value})}
                        />
                      </div>
                    </div>


                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף פריט
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="credit" className="mt-3">
                  <div className="space-y-3">
                    <div>
                      <Label>בחר פריט לזיכוי (אופציונלי)</Label>
                      <Select
                        value={lineItemForm.פריט_id || ""}
                        onValueChange={(value) => {
                          if (value) {
                            const item = items.find(i => i.id === value);
                            if (item) {
                              setLineItemForm({
                                ...lineItemForm,
                                פריט_id: value,
                                תיאור: item.שם_פריט,
                                מחיר_יחידה: item.מחיר_מכירה,
                                סוג_שורה: "זיכוי_מלאי"
                              });
                              setCreditSearch("");
                            }
                          } else {
                            setLineItemForm({
                              ...lineItemForm,
                              פריט_id: "",
                              תיאור: "",
                              מחיר_יחידה: 0,
                              סוג_שורה: "זיכוי_מלאי"
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר פריט או הזן ידנית" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <Input
                              placeholder=""
                              value={creditSearch}
                              onChange={(e) => {
                                e.stopPropagation();
                                setCreditSearch(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-8"
                            />
                          </div>
                          <div className="p-1">
                            <SelectItem value={null}>ללא - הזנה ידנית</SelectItem>
                            {items
                              .filter(i => i.פעיל && i.סוג_פריט === 'פריט')
                              .filter(i => {
                                if (!creditSearch) return true;
                                const search = creditSearch.toLowerCase().trim();
                                const name = (i.שם_פריט || '').toLowerCase();
                                const catalog = (i.מספר_קטלוג || '').toLowerCase();
                                const desc = (i.תיאור || '').toLowerCase();

                                return name.includes(search) || catalog.includes(search) || desc.includes(search);
                              })
                              .map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  <div className="flex flex-col items-start">
                                    <div className="font-medium">{item.שם_פריט}</div>
                                    <div className="text-xs text-gray-500">
                                      {item.מספר_קטלוג && `קטלוג: ${item.מספר_קטלוג} | `}
                                      ₪{item.מחיר_מכירה?.toFixed(2)}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            {items.filter(i => i.פעיל && i.סוג_פריט === 'פריט').filter(i => {
                              if (!creditSearch) return false;
                              const search = creditSearch.toLowerCase().trim();
                              const name = (i.שם_פריט || '').toLowerCase();
                              const catalog = (i.מספר_קטלוג || '').toLowerCase();
                              const desc = (i.תיאור || '').toLowerCase();

                              return name.includes(search) || catalog.includes(search) || desc.includes(search);
                            }).length === 0 && creditSearch && (
                              <div className="text-sm text-gray-500 text-center py-4">
                                לא נמצאו פריטים תואמים
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>תיאור הפריט *</Label>
                      <Textarea
                        value={lineItemForm.תיאור}
                        onChange={(e) => setLineItemForm({...lineItemForm, תיאור: e.target.value})}
                        placeholder="הזן תיאור הפריט לזיכוי מלאי"
                        required
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>כמות *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={lineItemForm.כמות}
                          onChange={(e) => setLineItemForm({...lineItemForm, כמות: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>מחיר ליחידה *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lineItemForm.מחיר_יחידה}
                          onChange={(e) => setLineItemForm({...lineItemForm, מחיר_יחידה: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label>הנחה %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={lineItemForm.הנחה_אחוז}
                          onChange={(e) => setLineItemForm({...lineItemForm, הנחה_אחוז: e.target.value})}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף לזיכוי מלאי
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </form>

            {currentInvoiceLines.length > 0 ? (
              <div className="space-y-6">
                {currentInvoiceLines.filter(l => l.סוג_שורה === 'עבודה').length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800">עבודה</Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>מיון</TableHead>
                          <TableHead>תיאור</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>מחיר</TableHead>
                          <TableHead>הנחה</TableHead>
                          <TableHead>סה"כ</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentInvoiceLines.filter(l => l.סוג_שורה === 'עבודה').map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-bold text-blue-600">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={getLineSort(line)}
                                onChange={(e) => {
                                  const newSort = parseInt(e.target.value) || 1;
                                  handleLocalSortChange(line.id, newSort);
                                }}
                                className="w-16 h-8 text-center"
                              />
                            </TableCell>
                            <TableCell>{line.תיאור}</TableCell>
                            <TableCell>{line.כמות}</TableCell>
                            <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                            <TableCell>{line.הנחה_אחוז}%</TableCell>
                            <TableCell className="font-bold">₪{line.סכום_שורה?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLineMutation.mutate(line.id)}
                                className="text-red-600"
                                title="מחק שורה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {currentInvoiceLines.filter(l => l.סוג_שורה === 'פריט').length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">פריטים</Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>מיון</TableHead>
                          <TableHead>תיאור</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>מחיר</TableHead>
                          <TableHead>הנחה</TableHead>
                          <TableHead>סה"כ</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentInvoiceLines.filter(l => l.סוג_שורה === 'פריט').map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-bold text-blue-600">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={getLineSort(line)}
                                onChange={(e) => {
                                  const newSort = parseInt(e.target.value) || 1;
                                  handleLocalSortChange(line.id, newSort);
                                }}
                                className="w-16 h-8 text-center"
                              />
                            </TableCell>
                            <TableCell>{line.תיאור}</TableCell>
                            <TableCell>{line.כמות}</TableCell>
                            <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                            <TableCell>{line.הנחה_אחוז}%</TableCell>
                            <TableCell className="font-bold">₪{line.סכום_שורה?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLineMutation.mutate(line.id)}
                                className="text-red-600"
                                title="מחק שורה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {currentInvoiceLines.filter(l => l.סוג_שורה === 'זיכוי_מלאי').length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">חומרים לזיכוי מלאי</Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>מיון</TableHead>
                          <TableHead>תיאור</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>מחיר</TableHead>
                          <TableHead>הנחה</TableHead>
                          <TableHead>סה"כ</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentInvoiceLines.filter(l => l.סוג_שורה === 'זיכוי_מלאי').map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-bold text-blue-600">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={getLineSort(line)}
                                onChange={(e) => {
                                  const newSort = parseInt(e.target.value) || 1;
                                  handleLocalSortChange(line.id, newSort);
                                }}
                                className="w-16 h-8 text-center"
                              />
                            </TableCell>
                            <TableCell>{line.תיאור}</TableCell>
                            <TableCell>{line.כמות}</TableCell>
                            <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                            <TableCell>{line.הנחה_אחוז}%</TableCell>
                            <TableCell className="font-bold">₪{line.סכום_שורה?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLineMutation.mutate(line.id)}
                                className="text-red-600"
                                title="מחק שורה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50 mb-4">
                <p>אין שורות בחשבון זה</p>
                <p className="text-sm mt-1">הוסף שורות באמצעות הטופס למעלה</p>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <div className="space-y-2 text-left">
                <div className="flex justify-between">
                  <span>סכום לפני מע"מ:</span>
                  <span className="font-bold">₪{currentTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>מע"מ (18%):</span>
                  <span className="font-bold">₪{currentTotals.vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg border-t pt-2">
                  <span className="font-bold">סה"כ כולל מע"מ:</span>
                  <span className="font-bold text-green-600">₪{currentTotals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              {Object.keys(localLineSorts).length > 0 && (
                <Button
                  onClick={handleApplySorting}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={bulkUpdateLinesMutation.isPending}
                >
                  {bulkUpdateLinesMutation.isPending ? 'מעדכן...' : 'מיין עכשיו'}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setShowLineItems(false)}
                variant="outline"
              >
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-lg">
          <CardHeader className="border-b p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Search className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
              <Input
                placeholder="חיפוש חשבון..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm md:text-base"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('מספר_חשבונית')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        מספר חשבון
                        <SortIcon field="מספר_חשבונית" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('מספר_דוח')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        הוראת עבודה
                        <SortIcon field="מספר_דוח" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('מספר_493')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        493
                        <SortIcon field="מספר_493" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('לקוח')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        לקוח
                        <SortIcon field="לקוח" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('תאריך')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        תאריך
                        <SortIcon field="תאריך" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('סכום')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        סכום
                        <SortIcon field="סכום" />
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">שולם</TableHead>
                    <TableHead className="whitespace-nowrap">נותר</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('סטטוס')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        סטטוס
                        <SortIcon field="סטטוס" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('קוד_מערכת')}
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        קוד מערכת
                        <SortIcon field="קוד_מערכת" />
                      </div>
                    </TableHead>
                    <TableHead className="text-left sticky left-0 bg-white shadow-sm whitespace-nowrap">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDisplayedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium whitespace-nowrap">{invoice.מספר_חשבונית}</TableCell>
                      <TableCell className="font-medium text-purple-600 whitespace-nowrap">{invoice.מספר_דוח || '-'}</TableCell>
                      <TableCell className="font-medium text-blue-600 whitespace-nowrap">{invoice.מספר_493 || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{getCustomerName(invoice.לקוח_id)}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(invoice.תאריך), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-bold text-gray-900 whitespace-nowrap">
                        ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="font-bold text-green-600 whitespace-nowrap">
                        ₪{invoice.סכום_שולם?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="font-bold text-orange-600 whitespace-nowrap">
                        ₪{calculateRemaining(invoice).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className={statusColors[invoice.סטטוס]}>
                          {invoice.סטטוס}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-600 whitespace-nowrap">{invoice.קוד_מערכת}</TableCell>
                      <TableCell className="sticky left-0 bg-white shadow-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(invoice)}
                            title="ערוך פרטי חשבון"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManagePayments(invoice)}
                            title="ניהול תשלומים"
                            className="text-green-600"
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManageLines(invoice.id)}
                            title="ניהול שורות"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCurrentInvoiceId(invoice.id);
                              setShowDocumentsDialog(true);
                            }}
                            title="מסמכים מצורפים"
                            className="text-purple-600"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateInvoicePDF(invoice.id)}
                            title="הורד חשבונית PDF"
                            className="text-blue-600"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInvoiceMutation.mutate(invoice.id)}
                            className="text-red-600 hover:text-red-700"
                            title="מחק חשבון"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y">
              {currentDisplayedInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">
                        קוד: {invoice.קוד_מערכת}
                      </div>
                      <div className="font-bold text-gray-900 mb-1">
                        חשבון #{invoice.מספר_חשבונית}
                      </div>
                      {invoice.מספר_דוח && (
                        <div className="text-sm text-purple-600 mb-1">
                          הוראת עבודה: {invoice.מספר_דוח}
                        </div>
                      )}
                      {invoice.מספר_493 && (
                        <div className="text-sm text-blue-600 mb-1">
                          493: {invoice.מספר_493}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 mb-1">
                        {getCustomerName(invoice.לקוח_id)}
                      </div>
                    </div>
                    <Badge className={statusColors[invoice.סטטוס]}>
                      {invoice.סטטוס}
                    </Badge>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    תאריך: {format(new Date(invoice.תאריך), 'dd/MM/yyyy')}
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg mb-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">סה"כ:</span>
                      <span className="font-bold">₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">שולם:</span>
                      <span className="font-bold text-green-600">₪{invoice.סכום_שולם?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">נותר:</span>
                      <span className="font-bold text-orange-600">₪{calculateRemaining(invoice).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(invoice)}
                      className="text-xs"
                    >
                      <Edit className="w-3 h-3 ml-1" />
                      ערוך
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManagePayments(invoice)} // Updated handler
                      className="text-xs text-green-600"
                    >
                      <DollarSign className="w-3 h-3 ml-1" />
                      תשלומים
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageLines(invoice.id)}
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 ml-1" />
                      שורות
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentInvoiceId(invoice.id);
                        setShowDocumentsDialog(true);
                      }}
                      className="text-xs text-purple-600"
                    >
                      <FileText className="w-3 h-3 ml-1" />
                      מסמכים
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateInvoicePDF(invoice.id)}
                      className="text-xs text-blue-600"
                    >
                      <Download className="w-3 h-3 ml-1" />
                      PDF
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteInvoiceMutation.mutate(invoice.id)}
                    className="w-full mt-2 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 ml-1" />
                    מחק חשבון
                  </Button>
                </div>
              ))}
              {currentDisplayedInvoices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  אין חשבונות
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}