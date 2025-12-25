import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Users, Phone, Mail, User, Search, MapPin, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Receipt } from "lucide-react"; // Added Receipt
import { Switch } from "@/components/ui/switch";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns'; // Import date-fns for date formatting

export default function CustomersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [viewingInvoicesCustomer, setViewingInvoicesCustomer] = useState(null);
  const [isInvoicesDialogOpen, setIsInvoicesDialogOpen] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    מספר_הוראת_עבודה: "", // Added new field
    מספר_מרכזייה_צרכן: "",
    שם_לקוח: "",
    טלפון: "",
    אימייל: "",
    כתובת: "",
    איש_קשר: "",
    מנהל_אתר: "",
    תאריך_הדפסה_אחרון: "",
    פעיל: true
  });

  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['לקוח'],
    queryFn: () => base44.entities.לקוח.list('-created_date'),
    initialData: [],
  });

  // workOrders is no longer needed for getWorkOrdersCount, but keeping it if there are other uses.
  // If no other uses, it can be removed. For now, leaving it.
  const { data: workOrders } = useQuery({
    queryKey: ['הזמנת_עבודה'],
    queryFn: () => base44.entities.הזמנת_עבודה.list(),
    initialData: [],
  });

  const { data: invoices } = useQuery({
    queryKey: ['חשבונית'],
    queryFn: () => base44.entities.חשבונית.list(),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.לקוח.create(data),
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['לקוח'] });
      setIsDialogOpen(false);
      resetForm();
      // מעבר אוטומטי ליצירת חשבונית עם הלקוח החדש
      navigate(createPageUrl('Invoices') + `?newCustomerId=${newCustomer.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.לקוח.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['לקוח'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.לקוח.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['לקוח'] });
    },
  });

  const resetForm = () => {
    setFormData({
      מספר_הוראת_עבודה: "", // Reset new field
      מספר_מרכזייה_צרכן: "",
      שם_לקוח: "",
      טלפון: "",
      אימייל: "",
      כתובת: "",
      איש_קשר: "",
      מנהל_אתר: "",
      תאריך_הדפסה_אחרון: "",
      פעיל: true
    });
    setEditingCustomer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      מספר_הוראת_עבודה: customer.מספר_הוראת_עבודה || "", // Populate new field
      מספר_מרכזייה_צרכן: customer.מספר_מרכזייה_צרכן || "",
      שם_לקוח: customer.שם_לקוח,
      טלפון: customer.טלפון || "", // Ensure phone is populated, even if null/undefined
      אימייל: customer.אימייל || "",
      כתובת: customer.כתובת || "",
      איש_קשר: customer.איש_קשר || "",
      מנהל_אתר: customer.מנהל_אתר || "",
      תאריך_הדפסה_אחרון: customer.תאריך_הדפסה_אחרון ? format(new Date(customer.תאריך_הדפסה_אחרון), 'yyyy-MM-dd') : "",
      פעיל: customer.פעיל
    });
    setIsDialogOpen(true);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx');
    const isCsv = fileName.endsWith('.csv');

    if (!isXlsx && !isCsv) {
      alert("הקובץ שהעלית אינו נתמך.\n\nפורמטים נתמכים: .xlsx, .csv\n\nאם יש לך קובץ .xls (Excel ישן):\n1. פתח את הקובץ ב-Excel\n2. שמור בשם (Save As)\n3. בחר 'Excel Workbook (.xlsx)' או 'CSV'");
      e.target.value = null;
      return;
    }

    setImportFile(file);
    setIsProcessing(true);
    setImportPreview(null);
    setImportResults(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const jsonSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            "מספר טלפון": { type: "string" },
            "איש קשר": { type: "string" },
            "מספר מרכזייה צרכן | כתובת לקוח": { type: "string" },
            "מידע לקוח": { type: "string" },
            "מנהל אתר": { type: "string" },
            "תאריך הדפסה אחרון": { type: "string" },
            "מספר הוראת עבודה": { type: "string" }
          }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: jsonSchema
      });

      if (result.status === "success" && result.output) {
        // המרת שמות שדות מהקובץ לשדות של המערכת
        const mappedRecords = result.output.map(record => {
          // חילוץ מספר מרכזייה/צרכן מהשדה המשולב
          let merkeziya = "";
          const combinedField = record["מספר מרכזייה צרכן | כתובת לקוח"];
          if (combinedField) {
            if (combinedField.includes("|")) {
              merkeziya = combinedField.split("|")[0].trim();
            } else {
              merkeziya = combinedField;
            }
          }

          // המרת תאריך אם קיים
          let dateFormatted = "";
          const dateStr = record["תאריך הדפסה אחרון"];
          if (dateStr) {
            try {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                let day = parts[0].padStart(2, '0');
                let month = parts[1].padStart(2, '0');
                let year = parts[2];
                
                if (year.length === 2) {
                  year = '20' + year; // Assuming 2-digit years are in the 21st century
                }
                
                dateFormatted = `${year}-${month}-${day}`;
              } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) { // Already in YYYY-MM-DD
                dateFormatted = dateStr;
              } else { // Try to parse with date-fns for other formats
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate)) {
                  dateFormatted = format(parsedDate, 'yyyy-MM-dd');
                }
              }
            } catch (e) {
              console.error("Error parsing date:", e);
            }
          }

          return {
            מספר_הוראת_עבודה: record["מספר הוראת עבודה"] || "",
            שם_לקוח: record["מידע לקוח"] || "",
            טלפון: (record["מספר טלפון"] && record["מספר טלפון"].trim() !== "" && record["מספר טלפון"] !== "default_value") ? record["מספר טלפון"] : "",
            מספר_מרכזייה_צרכן: merkeziya,
            איש_קשר: record["איש קשר"] || "",
            מנהל_אתר: record["מנהל אתר"] || "",
            תאריך_הדפסה_אחרון: dateFormatted || "",
            כתובת: "", // No direct mapping for address, can be added if needed
            אימייל: "" // No direct mapping for email, can be added if needed
          };
        }).filter(r => r.שם_לקוח && r.שם_לקוח.trim() !== '');
        
        if (mappedRecords.length > 0) {
          setImportPreview(mappedRecords);
          
          // הודעה למשתמש על כמות הרשומות
          if (mappedRecords.length >= 1000) {
            alert(`⚠️ שים לב: נטענו ${mappedRecords.length} רשומות מהקובץ.\n\nאם יש יותר רשומות בקובץ המקורי, ייתכן שהמערכת הגבילה את הכמות.\nבמקרה כזה, מומלץ לחלק את הקובץ למספר קבצים קטנים יותר.`);
          }
        } else {
          alert("לא נמצאו לקוחות תקינים בקובץ. אנא ודא שיש לפחות עמודה 'מידע לקוח'.");
        }
      } else {
        alert("שגיאה בעיבוד הקובץ: " + (result.details || "פורמט לא תקין או שהקובץ ריק."));
      }
    } catch (error) {
      console.error("Error processing file:", error);
      let errorMessage = "שגיאה בעיבוד הקובץ: " + error.message;
      if (error.message.includes("File processing failed")) {
        errorMessage = "סוג קובץ לא נתמך או שהוא פגום.\n\nנא לוודא שהקובץ בפורמט .xlsx או .csv תקין.";
      }
      alert(errorMessage + "\n\nנסה שוב או פנה לתמיכה.");
      e.target.value = null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0) return;

    setIsProcessing(true);
    try {
      // הוספת פעיל: true לכל לקוח
      const recordsToImport = importPreview.map(record => ({
        ...record,
        פעיל: true
      }));

      await base44.entities.לקוח.bulkCreate(recordsToImport);

      setImportResults({
        success: true,
        count: recordsToImport.length
      });

      await queryClient.invalidateQueries({ queryKey: ['לקוח'] });

      // סגירה אוטומטית אחרי 2 שניות
      setTimeout(() => {
        setIsImportDialogOpen(false);
        setImportFile(null);
        setImportPreview(null);
        setImportResults(null);
      }, 2000);
    } catch (error) {
      setImportResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getCustomerInvoices = (customer) => {
    if (!customer.מספר_הוראת_עבודה) return [];
    return invoices.filter(inv => inv.מספר_דוח === customer.מספר_הוראת_עבודה);
  };

  // Removed getWorkOrdersCount as the 'מספר הוראת עבודה' field is now a direct customer attribute.
  // The original prompt implies this field is a unique identifier *for the customer*, not a count of related work orders.

  const filteredCustomers = customers.filter(customer =>
    customer.שם_לקוח?.includes(searchTerm) ||
    customer.טלפון?.includes(searchTerm) ||
    customer.אימייל?.includes(searchTerm) ||
    customer.כתובת?.includes(searchTerm) ||
    customer.מספר_מרכזייה_צרכן?.includes(searchTerm) ||
    customer.מספר_הוראת_עבודה?.includes(searchTerm) ||
    customer.מנהל_אתר?.includes(searchTerm) ||
    customer.איש_קשר?.includes(searchTerm)
  );

  // הצגת 10 ראשונים אם אין חיפוש, אחרת כל התוצאות
  const displayedCustomers = searchTerm ? filteredCustomers : filteredCustomers.slice(0, 10);

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 md:w-8 md:h-8" />
              ניהול לקוחות
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">רשימת כל הלקוחות במערכת</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 w-full sm:w-auto text-sm md:text-base">
                  <Upload className="w-4 h-4 ml-2" />
                  ייבוא מ-Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    ייבוא לקוחות מקובץ Excel
                  </DialogTitle>
                </DialogHeader>

                {!importPreview && !importResults && (
                  <div className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription>
                        <div className="text-sm space-y-2">
                          <p className="font-semibold">📋 הנחיות לקובץ Excel/CSV:</p>
                          <ul className="list-disc mr-5 space-y-1">
                            <li>העמודה הנדרשת: <strong>מידע לקוח</strong></li>
                            <li>עמודות אופציונליות: <strong>מספר הוראת עבודה</strong>, <strong>מספר טלפון</strong>, מספר מרכזייה צרכן | כתובת לקוח, איש קשר, מנהל אתר, תאריך הדפסה אחרון</li>
                            <li>השורה הראשונה חייבת להכיל את שמות העמודות</li>
                            <li className="font-bold text-blue-700">פורמטים נתמכים: .xlsx, .csv בלבד</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <Alert className="bg-green-50 border-green-200">
                      <AlertDescription>
                        <div className="text-sm">
                          <p className="font-semibold text-green-800 mb-2">✅ שמות העמודות המצופים:</p>
                          <div className="bg-white p-3 rounded border border-green-300 text-xs space-y-1">
                            <div><strong>מספר הוראת עבודה</strong> - מספר הוראת העבודה הייחודי ללקוח (אופציונלי)</div>
                            <div><strong>מידע לקוח</strong> - שם הלקוח (חובה)</div>
                            <div><strong>מספר טלפון</strong> - טלפון הלקוח (אופציונלי)</div>
                            <div><strong>מספר מרכזייה צרכן | כתובת לקוח</strong> - מספר מרכזייה (אופציונלי)</div>
                            <div><strong>איש קשר</strong> - שם איש הקשר (אופציונלי)</div>
                            <div><strong>מנהל אתר</strong> - שם מנהל אתר (אופציונלי)</div>
                            <div><strong>תאריך הדפסה אחרון</strong> - תאריך (אופציונלי)</div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <div className="text-sm text-gray-600 mb-2">
                        לחץ לבחירת קובץ או גרור לכאן
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        קבצים נתמכים: .xlsx, .csv
                      </div>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          const input = document.getElementById('file-upload');
                          input.value = null;
                          input.click();
                        }}
                      >
                        בחר קובץ
                      </Button>
                      {importFile && (
                        <div className="mt-3 text-xs text-gray-50">
                          קובץ נבחר: {importFile.name}
                        </div>
                      )}
                    </div>

                    {isProcessing && (
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                        <span>מעבד קובץ... זה עשוי לקחת מספר שניות</span>
                      </div>
                    )}
                  </div>
                )}

                {importPreview && !importResults && (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        נמצאו {importPreview.length} לקוחות בקובץ
                      </AlertDescription>
                    </Alert>

                    <div className="max-h-96 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>מספר הוראת עבודה</TableHead>
                            <TableHead>מרכזייה/צרכן</TableHead>
                            <TableHead>שם לקוח</TableHead>
                            <TableHead>טלפון</TableHead>
                            <TableHead>איש קשר</TableHead>
                            <TableHead>מנהל אתר</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.slice(0, 10).map((record, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{record.מספר_הוראת_עבודה || '-'}</TableCell>
                              <TableCell className="text-sm">{record.מספר_מרכזייה_צרכן || '-'}</TableCell>
                              <TableCell className="text-sm font-medium">{record.שם_לקוח}</TableCell>
                              <TableCell className="text-sm">{record.טלפון || '-'}</TableCell>
                              <TableCell className="text-sm">{record.איש_קשר || '-'}</TableCell>
                              <TableCell className="text-sm">{record.מנהל_אתר || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {importPreview.length > 10 && (
                        <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                          מוצגים 10 רשומות ראשונות מתוך {importPreview.length}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportPreview(null);
                          setImportFile(null);
                        }}
                      >
                        ביטול
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            מייבא...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 ml-2" />
                            אשר ייבוא
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {importResults && (
                  <div className="space-y-4">
                    {importResults.success ? (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <AlertDescription>
                          <div className="font-semibold text-green-900">
                            הייבוא הושלם בהצלחה!
                          </div>
                          <div className="text-sm text-green-700 mt-1">
                            {importResults.count} לקוחות נוספו למערכת
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-red-50 border-red-200">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <AlertDescription>
                          <div className="font-semibold text-red-900">
                            שגיאה בייבוא
                          </div>
                          <div className="text-sm text-red-700 mt-1">
                            {importResults.error}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-sm md:text-base" onClick={resetForm}>
                  <Plus className="w-4 h-4 ml-2" />
                  לקוח חדש
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? 'עריכת לקוח' : 'לקוח חדש'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>מספר הוראת עבודה *</Label>
                    <Input
                      value={formData.מספר_הוראת_עבודה}
                      onChange={(e) => setFormData({...formData, מספר_הוראת_עבודה: e.target.value})}
                      placeholder=""
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">מספר ייחודי ללקוח</p>
                  </div>
                  <div>
                    <Label>מספר מרכזייה/צרכן</Label>
                    <Input
                      value={formData.מספר_מרכזייה_צרכן}
                      onChange={(e) => setFormData({...formData, מספר_מרכזייה_צרכן: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>שם צרכן *</Label>
                    <Input
                      value={formData.שם_לקוח}
                      onChange={(e) => setFormData({...formData, שם_לקוח: e.target.value})}
                      placeholder=""
                      required
                    />
                  </div>
                  <div>
                    <Label>כתובת</Label>
                    <Input
                      value={formData.כתובת}
                      onChange={(e) => setFormData({...formData, כתובת: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>מפקח</Label>
                    <Input
                      value={formData.מנהל_אתר}
                      onChange={(e) => setFormData({...formData, מנהל_אתר: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>תאריך הדפסה</Label>
                    <Input
                      type="date"
                      value={formData.תאריך_הדפסה_אחרון}
                      onChange={(e) => setFormData({...formData, תאריך_הדפסה_אחרון: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>טלפון</Label>
                    <Input
                      value={formData.טלפון}
                      onChange={(e) => setFormData({...formData, טלפון: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>אימייל</Label>
                    <Input
                      type="email"
                      value={formData.אימייל}
                      onChange={(e) => setFormData({...formData, אימייל: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>איש קשר</Label>
                    <Input
                      value={formData.איש_קשר}
                      onChange={(e) => setFormData({...formData, איש_קשר: e.target.value})}
                      placeholder=""
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.פעיל}
                      onCheckedChange={(checked) => setFormData({...formData, פעיל: checked})}
                    />
                    <Label>לקוח פעיל</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      ביטול
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingCustomer ? 'עדכן' : 'צור לקוח'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 p-3 md:p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 md:gap-4">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
                <Input
                  placeholder="חיפוש לקוח..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-sm md:text-base"
                />
              </div>
              {!searchTerm && filteredCustomers.length > 10 && (
                <div className="text-xs md:text-sm text-gray-600">
                  מוצגים 10 לקוחות מתוך {filteredCustomers.length} • השתמש בחיפוש למציאת לקוחות ספציפיים
                </div>
              )}
              {searchTerm && (
                <div className="text-xs md:text-sm text-blue-600 font-medium">
                  נמצאו {displayedCustomers.length} תוצאות
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold text-gray-700">מספר הוראת עבודה</TableHead>
                    <TableHead className="font-bold text-gray-700">חשבונות</TableHead>
                    <TableHead className="font-bold text-gray-700">תאריך הדפסה</TableHead>
                    <TableHead className="font-bold text-gray-700">מפקח</TableHead>
                    <TableHead className="font-bold text-gray-700">מידע לקוח</TableHead>
                    <TableHead className="font-bold text-gray-700">כתובת לקוח</TableHead>
                    <TableHead className="font-bold text-gray-700">מספר מרכזייה/צרכן</TableHead>
                    <TableHead className="font-bold text-gray-700">איש קשר</TableHead>
                    <TableHead className="font-bold text-gray-700">מספר טלפון</TableHead>
                    <TableHead className="font-bold text-gray-700 text-center">סטטוס</TableHead>
                    <TableHead className="font-bold text-gray-700 text-left">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedCustomers.map((customer, index) => {
                    const customerInvoices = getCustomerInvoices(customer);
                    return (
                      <TableRow
                        key={customer.id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                      >
                        <TableCell className="font-medium text-blue-600">
                          {customer.מספר_הוראת_עבודה || '-'}
                        </TableCell>
                        <TableCell>
                          {customerInvoices.length > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setViewingInvoicesCustomer(customer);
                                setIsInvoicesDialogOpen(true);
                              }}
                              className="text-green-700 border-green-300 hover:bg-green-50"
                            >
                              <Receipt className="w-4 h-4 ml-1" />
                              חשבונות ({customerInvoices.length})
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs">אין חשבונות</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {customer.תאריך_הדפסה_אחרון ? format(new Date(customer.תאריך_הדפסה_אחרון), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {customer.מנהל_אתר || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">{customer.שם_לקוח}</div>
                          {customer.אימייל && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" />
                              {customer.אימייל}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.כתובת ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{customer.כתובת}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-600">
                          {customer.מספר_מרכזייה_צרכן || '-'}
                        </TableCell>
                        <TableCell>
                          {customer.איש_קשר ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{customer.איש_קשר}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.טלפון && customer.טלפון.trim() !== "" && customer.טלפון !== "default_value" ? (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{customer.טלפון}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400"></span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={customer.פעיל ? "bg-green-100 text-green-800 font-medium" : "bg-gray-100 text-gray-800 font-medium"}>
                            {customer.פעיל ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(customer)}
                              className="hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(customer.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {displayedCustomers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        לא נמצאו לקוחות
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y">
              {displayedCustomers.map((customer) => {
                const customerInvoices = getCustomerInvoices(customer);
                return (
                  <div key={customer.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 mb-1">{customer.שם_לקוח}</div>
                        {customer.מספר_הוראת_עבודה && (
                          <div className="text-sm text-blue-600 mb-1">
                            הוראת עבודה: {customer.מספר_הוראת_עבודה}
                          </div>
                        )}
                        {customerInvoices.length > 0 && (
                          <div className="mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setViewingInvoicesCustomer(customer);
                                setIsInvoicesDialogOpen(true);
                              }}
                              className="text-green-700 border-green-300 hover:bg-green-50"
                            >
                              <Receipt className="w-4 h-4 ml-1" />
                              חשבונות ({customerInvoices.length})
                            </Button>
                          </div>
                        )}
                        {customer.מספר_מרכזייה_צרכן && (
                          <div className="text-sm text-gray-600 mb-1">
                            מרכזייה: {customer.מספר_מרכזייה_צרכן}
                          </div>
                        )}
                      </div>
                      <Badge className={customer.פעיל ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {customer.פעיל ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </div>
                    
                    {customer.טלפון && customer.טלפון.trim() && customer.טלפון !== "default_value" && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${customer.טלפון}`} className="text-blue-600 hover:underline">
                          {customer.טלפון}
                        </a>
                      </div>
                    )}
                    
                    {customer.כתובת && (
                      <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{customer.כתובת}</span>
                      </div>
                    )}

                    {customer.אימייל && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${customer.אימייל}`} className="text-blue-600 hover:underline">
                          {customer.אימייל}
                        </a>
                      </div>
                    )}
                    
                    {customer.איש_קשר && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <User className="w-4 h-4" />
                        <span>איש קשר: {customer.איש_קשר}</span>
                      </div>
                    )}

                    {customer.מנהל_אתר && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <User className="w-4 h-4" />
                        <span>מנהל אתר: {customer.מנהל_אתר}</span>
                      </div>
                    )}

                    {customer.תאריך_הדפסה_אחרון && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <span>תאריך הדפסה אחרון: {format(new Date(customer.תאריך_הדפסה_אחרון), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        ערוך
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(customer.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1"
                      >
                        <Trash2 className="w-4 h-4 ml-1" />
                        מחק
                      </Button>
                    </div>
                  </div>
                );
              })}
              {displayedCustomers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  לא נמצאו לקוחות
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog for viewing customer invoices */}
        <Dialog open={isInvoicesDialogOpen} onOpenChange={setIsInvoicesDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                חשבונות של {viewingInvoicesCustomer?.שם_לקוח}
              </DialogTitle>
            </DialogHeader>
            {viewingInvoicesCustomer && (
              <div className="space-y-3">
                {getCustomerInvoices(viewingInvoicesCustomer).map((invoice) => (
                  <Card key={invoice.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-bold text-lg text-gray-900">
                          חשבונית #{invoice.מספר_חשבונית}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          תאריך: {format(new Date(invoice.תאריך), 'dd/MM/yyyy')}
                        </div>
                        {invoice.מספר_דוח && (
                          <div className="text-sm text-gray-600">
                            מספר דוח: {invoice.מספר_דוח}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <Badge className={
                          invoice.סטטוס === 'שולמה' ? 'bg-green-100 text-green-800' :
                          invoice.סטטוס === 'טרם שולמה' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {invoice.סטטוס}
                        </Badge>
                        <div className="text-xl font-bold text-green-600 mt-2">
                          ₪{invoice.סכום_כולל?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {getCustomerInvoices(viewingInvoicesCustomer).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    אין חשבונות ללקוח זה
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}