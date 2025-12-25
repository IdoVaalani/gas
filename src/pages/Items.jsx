import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Package, Search, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ItemsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importType, setImportType] = useState("all");
  
  const linkedWorksRef = useRef([]);
  const [linkedWorkSearch, setLinkedWorkSearch] = useState("");
  
  const [formData, setFormData] = useState({
    מספר_קטלוג: "",
    שם_פריט: "",
    תיאור: "",
    סוג_פריט: "פריט",
    מחיר_מכירה: "",
    עבודות_מקושרות: [],
    פעיל: true
  });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState("all");

  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['פריט'],
    queryFn: () => base44.entities.פריט.list('-updated_date'),
    initialData: [],
  });

  const generateUniqueCatalogNumber = () => {
    let catalogNumber;
    let isUnique = false;

    while (!isUnique) {
      catalogNumber = Math.floor(100000 + Math.random() * 900000).toString();
      isUnique = !items.some(item => item.מספר_קטלוג === catalogNumber);
    }

    return catalogNumber;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.מספר_קטלוג || data.מספר_קטלוג.trim() === "") {
        data.מספר_קטלוג = generateUniqueCatalogNumber();
      }

      if (data.מספר_קטלוג) {
        const existingItem = items.find(item =>
          item.מספר_קטלוג === data.מספר_קטלוג
        );

        if (existingItem) {
          throw new Error(`מספר קטלוג ${data.מספר_קטלוג} כבר קיים במערכת`);
        }
      }

      return await base44.entities.פריט.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['פריט'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      alert(error.message || 'שגיאה ביצירת פריט');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (data.מספר_קטלוג) {
        const existingItem = items.find(item =>
          item.מספר_קטלוג === data.מספר_קטלוג &&
          item.id !== id
        );

        if (existingItem) {
          throw new Error(`מספר קטלוג ${data.מספר_קטלוג} כבר קיים במערכת`);
        }
      }

      return await base44.entities.פריט.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['פריט'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      alert(error.message || 'שגיאה בעדכון פריט');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.פריט.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['פריט'] });
    },
  });

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
            "מספר קטלוג": { type: "string" },
            "שם פריט": { type: "string" },
            "תיאור": { type: "string" },
            "סוג": { type: "string" },
            "מחיר מכירה": { type: "number" }
          },
          required: ["שם פריט", "מחיר מכירה"]
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: jsonSchema
      });

      if (result.status === "success" && result.output) {
        const mappedRecords = result.output.map(record => {
          let itemType = "פריט";
          
          if (record["סוג"] && String(record["סוג"]).trim() !== "") {
            const typeStr = String(record["סוג"]).toLowerCase();
            if (typeStr.includes("עבודה") || typeStr === "עבודה") {
              itemType = "עבודה";
            }
          }

          return {
            מספר_קטלוג: record["מספר קטלוג"] ? String(record["מספר קטלוג"]) : "",
            שם_פריט: record["שם פריט"] ? String(record["שם פריט"]) : "",
            תיאור: record["תיאור"] ? String(record["תיאור"]) : "",
            סוג_פריט: itemType,
            מחיר_מכירה: parseFloat(record["מחיר מכירה"]) || 0,
            פעיל: true
          };
        }).filter(r => {
          if (!r.שם_פריט || r.שם_פריט.trim() === '' || r.מחיר_מכירה <= 0) {
            return false;
          }
          
          if (importType === "items") {
            return r.סוג_פריט === "פריט";
          } else if (importType === "work") {
            return r.סוג_פריט === "עבודה";
          }
          return true;
        });
        
        if (mappedRecords.length > 0) {
          setImportPreview(mappedRecords);
        } else {
          const typeMessage = importType === "items" ? "פריטים" : 
                            importType === "work" ? "עבודות" : "פריטים";
          alert(`לא נמצאו ${typeMessage} תקינים בקובץ. אנא ודא שיש עמודות 'שם פריט' ו'מחיר מכירה' ושהן מכילות נתונים חוקיים.`);
        }
      } else {
        alert("שגיאה בעיבוד הקובץ: " + (result.details || "פורמט לא תקין או שהקובץ ריק."));
      }
    } catch (error) {
      console.error("Error processing file:", error);
      let errorMessage = "שגיאה בעיבוד הקובץ: " + error.message;
      if (error.message.includes("Unsupported file type") || error.message.includes("Unsupported Excel format")) {
        errorMessage = `❌ לא הצלחנו לקרוא את קובץ ה-Excel

🔧 פתרונות מומלצים (בחר אחד):

**פתרון 1 - שמור כ-CSV (מומלץ!):**
1. פתח את הקובץ ב-Excel
2. לחץ File → Save As
3. בחר "CSV UTF-8 (Comma delimited) (*.csv)"
4. שמור והעלה את הקובץ החדש

**פתרון 2 - שמור מחדש כ-XLSX:**
1. פתח את הקובץ ב-Excel  
2. לחץ File → Save As
3. בחר "Excel Workbook (*.xlsx)"
4. וודא שאתה בוחר את הגרסה החדשה ביותר
5. שמור והעלה את הקובץ החדש

💡 טיפ: קובצי CSV פשוטים יותר ועובדים תמיד!`;
      }
      alert(errorMessage);
      if (e.target) {
        e.target.value = null;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0) return;

    setIsProcessing(true);
    try {
      const generatedCatalogNumbers = new Set();
      const recordsToImport = importPreview.map(record => {
        if (!record.מספר_קטלוג || record.מספר_קטלוג.trim() === "") {
          let catalogNumber;
          let isUnique = false;
          
          while (!isUnique) {
            catalogNumber = Math.floor(100000 + Math.random() * 900000).toString();
            isUnique = !items.some(item => item.מספר_קטלוג === catalogNumber) && !generatedCatalogNumbers.has(catalogNumber);
          }
          generatedCatalogNumbers.add(catalogNumber);
          
          return {
            ...record,
            מספר_קטלוג: catalogNumber
          };
        }
        return record;
      });

      const finalRecordsForImport = [];
      const duplicateCatalogs = [];
      const seenCatalogNumbers = new Set(items.map(item => item.מספר_קטלוג));
      
      for (const record of recordsToImport) {
        if (!seenCatalogNumbers.has(record.מספר_קטלוג)) {
          finalRecordsForImport.push(record);
          seenCatalogNumbers.add(record.מספר_קטלוג);
        } else {
          duplicateCatalogs.push(record.מספר_קטלוג);
        }
      }

      if (finalRecordsForImport.length > 0) {
        await base44.entities.פריט.bulkCreate(finalRecordsForImport);
      }

      setImportResults({
        success: true,
        count: finalRecordsForImport.length,
        duplicates: duplicateCatalogs.length,
        total: recordsToImport.length
      });

      await queryClient.invalidateQueries({ queryKey: ['פריט'] });

      setTimeout(() => {
        setIsImportDialogOpen(false);
        setImportFile(null);
        setImportPreview(null);
        setImportResults(null);
      }, 3000);
    } catch (error) {
      setImportResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    let itemsToExport = [];
    
    if (exportType === "all") {
      itemsToExport = items;
    } else if (exportType === "items") {
      itemsToExport = items.filter(item => item.סוג_פריט === "פריט");
    } else if (exportType === "work") {
      itemsToExport = items.filter(item => item.סוג_פריט === "עבודה");
    }

    const headers = ['מספר קטלוג', 'שם פריט', 'תיאור', 'סוג', 'מחיר מכירה', 'סטטוס'];
    const rows = itemsToExport.map(item => [
      item.מספר_קטלוג || '',
      item.שם_פריט || '',
      item.תיאור || '',
      item.סוג_פריט || 'פריט',
      item.מחיר_מכירה?.toFixed(2) || '0.00',
      item.פעיל ? 'פעיל' : 'לא פעיל'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const typeLabel = exportType === "all" ? "כל_הפריטים" : 
                      exportType === "items" ? "פריטים" : "עבודות";
    link.download = `${typeLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setExportDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      מספר_קטלוג: "",
      שם_פריט: "",
      תיאור: "",
      סוג_פריט: "פריט",
      מחיר_מכירה: "",
      עבודות_מקושרות: [],
      פעיל: true
    });
    linkedWorksRef.current = [];
    setLinkedWorkSearch("");
    setEditingItem(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSubmit = {
      מספר_קטלוג: formData.מספר_קטלוג || "",
      שם_פריט: formData.שם_פריט,
      תיאור: formData.תיאור || "",
      סוג_פריט: formData.סוג_פריט || "פריט",
      מחיר_מכירה: parseFloat(formData.מחיר_מכירה),
      עבודות_מקושרות: linkedWorksRef.current.length > 0 ? [...linkedWorksRef.current] : [],
      פעיל: formData.פעיל
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const linkedWorks = Array.isArray(item.עבודות_מקושרות) ? item.עבודות_מקושרות : [];
    linkedWorksRef.current = linkedWorks;
    
    setFormData({
      מספר_קטלוג: item.מספר_קטלוג || "",
      שם_פריט: item.שם_פריט,
      תיאור: item.תיאור || "",
      סוג_פריט: item.סוג_פריט || "פריט",
      מחיר_מכירה: item.מחיר_מכירה,
      עבודות_מקושרות: linkedWorks,
      פעיל: item.פעיל
    });
    setIsDialogOpen(true);
  };

  const handleAddLinkedWork = (workId) => {
    if (workId && !linkedWorksRef.current.includes(workId)) {
      linkedWorksRef.current = [...linkedWorksRef.current, workId];
      
      setFormData(prev => ({
        ...prev,
        עבודות_מקושרות: [...linkedWorksRef.current]
      }));
    }
  };

  const handleRemoveLinkedWork = (workId) => {
    linkedWorksRef.current = linkedWorksRef.current.filter(id => id !== workId);
    setFormData(prev => ({
      ...prev,
      עבודות_מקושרות: [...linkedWorksRef.current]
    }));
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.שם_פריט?.includes(searchTerm) ||
      item.מספר_קטלוג?.includes(searchTerm) ||
      item.תיאור?.includes(searchTerm);

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "items") return matchesSearch && item.סוג_פריט === "פריט";
    if (activeTab === "work") return matchesSearch && item.סוג_פריט === "עבודה";

    return matchesSearch;
  });

  const itemsCount = items.filter(i => i.סוג_פריט === "פריט").length;
  const workCount = items.filter(i => i.סוג_פריט === "עבודה").length;


  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 md:w-8 md:h-8" />
              ניהול פריטים
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">רשימת כל הפריטים והשירותים</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 w-full sm:w-auto text-sm md:text-base">
                  <Download className="w-4 h-4 ml-2" />
                  ייצוא ל-Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    ייצוא פריטים ל-Excel
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">בחר מה לייצא:</Label>
                    <div className="space-y-2">
                      <div 
                        onClick={() => setExportType("all")}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          exportType === "all" 
                            ? "border-blue-500 bg-blue-50" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">הכל</div>
                            <div className="text-sm text-gray-600">
                              {items.length} פריטים ועבודות
                            </div>
                          </div>
                          {exportType === "all" && (
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </div>

                      <div 
                        onClick={() => setExportType("items")}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          exportType === "items" 
                            ? "border-blue-500 bg-blue-50" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">פריטים בלבד</div>
                            <div className="text-sm text-gray-600">
                              {items.filter(i => i.סוג_פריט === "פריט").length} פריטים
                            </div>
                          </div>
                          {exportType === "items" && (
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </div>

                      <div 
                        onClick={() => setExportType("work")}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          exportType === "work" 
                            ? "border-blue-500 bg-blue-50" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">עבודות בלבד</div>
                            <div className="text-sm text-gray-600">
                              {items.filter(i => i.סוג_פריט === "עבודה").length} עבודות
                            </div>
                          </div>
                          {exportType === "work" && (
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-sm">
                      💡 הקובץ ייוצא בפורמט CSV שנפתח ב-Excel
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setExportDialogOpen(false)}
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleExport}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="w-4 h-4 ml-2" />
                    ייצא
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
              setIsImportDialogOpen(open);
              if (!open) {
                setImportType("all");
                setImportFile(null);
                setImportPreview(null);
                setImportResults(null);
                setIsProcessing(false);
              }
            }}>
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
                    ייבוא פריטים מקובץ Excel
                  </DialogTitle>
                </DialogHeader>

                {!importFile && !importPreview && !importResults && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-semibold mb-3 block">בחר מה לייבא:</Label>
                      <div className="space-y-2 mb-4">
                        <div 
                          onClick={() => setImportType("all")}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            importType === "all" 
                              ? "border-blue-500 bg-blue-50" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">הכל</div>
                              <div className="text-sm text-gray-600">
                                פריטים ועבודות
                              </div>
                            </div>
                            {importType === "all" && (
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                        </div>

                        <div 
                          onClick={() => setImportType("items")}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            importType === "items" 
                              ? "border-blue-500 bg-blue-50" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">פריטים בלבד</div>
                              <div className="text-sm text-gray-600">
                                רק פריטים (לא עבודות)
                              </div>
                            </div>
                            {importType === "items" && (
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                        </div>

                        <div 
                          onClick={() => setImportType("work")}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            importType === "work" 
                              ? "border-blue-500 bg-blue-50" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">עבודות בלבד</div>
                              <div className="text-sm text-gray-600">
                                רק עבודות (לא פריטים)
                              </div>
                            </div>
                            {importType === "work" && (
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription>
                        <div className="text-sm space-y-2">
                          <p className="font-semibold">📋 הנחיות לקובץ Excel/CSV:</p>
                          <ul className="list-disc mr-5 space-y-1">
                            <li>עמודות חובה: <strong>שם פריט</strong>, <strong>מחיר מכירה</strong></li>
                            <li>עמודות אופציונליות: <strong>מספר קטלוג</strong>, <strong>תיאור</strong>, <strong>סוג</strong> (עבודה/פריט)</li>
                            <li>השורה הראשונה חייבת להכיל את שמות העמודות</li>
                            <li className="font-bold text-blue-700">פורמטים נתמכים: .xlsx, .csv בלבד</li>
                            <li className="text-blue-700">אם הקובץ לא עובד, נסה לשמור אותו כ-<strong>CSV</strong> - זה עובד תמיד! ✅</li>
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <Alert className="bg-green-50 border-green-200">
                      <AlertDescription>
                        <div className="text-sm">
                          <p className="font-semibold text-green-800 mb-2">✅ שמות העמודות המצופים:</p>
                          <div className="bg-white p-3 rounded border border-green-300 text-xs space-y-1">
                            <div><strong>מספר קטלוג</strong> - מספר קטלוג (אופציונלי - ייווצר אוטומטית)</div>
                            <div><strong>שם פריט</strong> - שם הפריט או השירות (חובה)</div>
                            <div><strong>תיאור</strong> - תיאור מפורט (אופציונלי)</div>
                            <div><strong>סוג</strong> - "עבודה" או "פריט" (אופציונלי, ברירת מחדל: פריט)</div>
                            <div><strong>מחיר מכירה</strong> - מחיר המכירה בשקלים (חובה)</div>
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
                        id="file-upload-items"
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
                          const input = document.getElementById('file-upload-items');
                          input.value = null;
                          input.click();
                        }}
                      >
                        בחר קובץ
                      </Button>
                    </div>

                    {isProcessing && (
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                        <span>מעבד קובץ...</span>
                      </div>
                    )}
                  </div>
                )}

                {importPreview && !importResults && (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        נמצאו {importPreview.length} פריטים בקובץ
                      </AlertDescription>
                    </Alert>

                    <div className="max-h-96 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>מספר קטלוג</TableHead>
                            <TableHead>שם פריט</TableHead>
                            <TableHead>סוג</TableHead>
                            <TableHead>מחיר</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.slice(0, 10).map((record, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{record.מספר_קטלוג || 'יווצר אוטומטית'}</TableCell>
                              <TableCell className="text-sm font-medium">{record.שם_פריט}</TableCell>
                              <TableCell className="text-sm">
                                <Badge className={record.סוג_פריט === 'עבודה' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}>
                                  {record.סוג_פריט}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-bold text-green-600">₪{record.מחיר_מכירה.toFixed(2)}</TableCell>
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
                          setIsProcessing(false);
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
                            {importResults.count} פריטים נוספו למערכת
                          </div>
                          {importResults.duplicates > 0 && (
                            <div className="text-sm text-orange-700 mt-1">
                              ⚠️ {importResults.duplicates} פריטים דולגו בגלל מספר קטלוג כפול
                            </div>
                          )}
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
                <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto" onClick={resetForm}>
                  <Plus className="w-4 h-4 ml-2" />
                  פריט חדש
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'עריכת פריט' : 'פריט חדש'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>מספר קטלוג (אופציונלי - ייווצר אוטומטית אם לא יוזן)</Label>
                    <Input
                      value={formData.מספר_קטלוג}
                      onChange={(e) => setFormData({...formData, מספר_קטלוג: e.target.value})}
                      placeholder="הזן מספר קטלוג או השאר ריק ליצירה אוטומטית"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      אם תשאיר ריק, המערכת תייצר מספר בן 6 ספרות אוטומטית
                    </p>
                  </div>
                  <div>
                    <Label>שם פריט *</Label>
                    <Input
                      value={formData.שם_פריט}
                      onChange={(e) => setFormData({...formData, שם_פריט: e.target.value})}
                      placeholder="הזן שם פריט"
                      required
                    />
                  </div>
                  <div>
                    <Label>סוג *</Label>
                    <Select value={formData.סוג_פריט} onValueChange={(value) => setFormData({...formData, סוג_פריט: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="עבודה">עבודה</SelectItem>
                        <SelectItem value="פריט">פריט</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.סוג_פריט === "פריט" && (
                    <div>
                      <Label>עבודות מקושרות (אופציונלי)</Label>
                      
                      {formData.עבודות_מקושרות && Array.isArray(formData.עבודות_מקושרות) && formData.עבודות_מקושרות.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          {formData.עבודות_מקושרות.map(workId => {
                            const work = items.find(i => i.id === workId);
                            return work ? (
                              <Badge key={workId} className="bg-blue-600 text-white pl-1 pr-3 py-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLinkedWork(workId)}
                                  className="hover:bg-blue-700 rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <span>{work.שם_פריט} (₪{work.מחיר_מכירה?.toFixed(2)})</span>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                      
                      <Select 
                        value="" 
                        onValueChange={(value) => {
                          if (value && value !== "null") {
                            handleAddLinkedWork(value);
                            setLinkedWorkSearch("");
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="הוסף עבודה..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <div className="sticky top-0 bg-white p-2 border-b z-10">
                            <Input
                              placeholder="חפש עבודה..."
                              value={linkedWorkSearch}
                              onChange={(e) => {
                                e.stopPropagation();
                                setLinkedWorkSearch(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-8"
                            />
                          </div>
                          <div className="p-1">
                            {items
                              .filter(i => 
                                i.פעיל && 
                                i.סוג_פריט === 'עבודה' && 
                                !(formData.עבודות_מקושרות || []).includes(i.id) &&
                                (linkedWorkSearch === "" || 
                                 i.שם_פריט?.toLowerCase().includes(linkedWorkSearch.toLowerCase()) ||
                                 i.מספר_קטלוג?.toLowerCase().includes(linkedWorkSearch.toLowerCase()))
                              )
                              .map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.שם_פריט} (₪{item.מחיר_מכירה?.toFixed(2)})
                                </SelectItem>
                              ))}
                          </div>
                        </SelectContent>
                      </Select>
                      
                      <p className="text-xs text-gray-500 mt-1">
                        כאשר תוסיף פריט זה לחשבונית, כל העבודות המקושרות יתווספו אוטומטית
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label>תיאור</Label>
                    <Textarea
                      value={formData.תיאור}
                      onChange={(e) => setFormData({...formData, תיאור: e.target.value})}
                      placeholder="תיאור מפורט של הפריט"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>מחיר מכירה (₪) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.מחיר_מכירה}
                      onChange={(e) => setFormData({...formData, מחיר_מכירה: e.target.value})}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.פעיל}
                      onCheckedChange={(checked) => setFormData({...formData, פעיל: checked})}
                    />
                    <Label>פריט פעיל</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      ביטול
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingItem ? 'עדכן' : 'צור פריט'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="חיפוש פריט..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="all">
                    הכל ({items.length})
                  </TabsTrigger>
                  <TabsTrigger value="items">
                    פריטים ({itemsCount})
                  </TabsTrigger>
                  <TabsTrigger value="work">
                    עבודות ({workCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מספר קטלוג</TableHead>
                    <TableHead>שם מוצר</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>תאריך עדכון</TableHead>
                    <TableHead>מחיר</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead className="text-left">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} onClick={() => handleEdit(item)} className="cursor-pointer">
                      <TableCell className="font-mono text-sm text-gray-600">
                        {item.מספר_קטלוג || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{item.שם_פריט}</TableCell>
                      <TableCell>
                        <Badge className={item.סוג_פריט === 'עבודה' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}>
                          {item.סוג_פריט}
                        </Badge>
                        {item.עבודות_מקושרות && Array.isArray(item.עבודות_מקושרות) && item.עבודות_מקושרות.length > 0 && (
                          <Badge className="bg-green-100 text-green-800 mr-1">
                            {item.עבודות_מקושרות.length} עבודות
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {item.updated_date ? format(new Date(item.updated_date), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">₪{item.מחיר_מכירה?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={item.פעיל ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {item.פעיל ? 'פעיל' : 'לא פעיל'}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-red-600 hover:text-red-700"
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

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(item)}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 mb-1">
                        {item.שם_פריט}
                      </div>
                      {item.מספר_קטלוג && (
                        <div className="text-xs text-gray-500 mb-2">
                          קטלוג: {item.מספר_קטלוג}
                        </div>
                      )}
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <Badge className={item.סוג_פריט === 'עבודה' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}>
                          {item.סוג_פריט}
                        </Badge>
                        {item.פעיל ? (
                          <Badge className="bg-green-100 text-green-800">פעיל</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">לא פעיל</Badge>
                        )}
                        {item.עבודות_מקושרות && Array.isArray(item.עבודות_מקושרות) && item.עבודות_מקושרות.length > 0 && (
                          <Badge className="bg-green-100 text-green-800">
                            {item.עבודות_מקושרות.length} עבודות מקושרות
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-lg font-bold text-green-600 mb-3">
                    ₪{item.מחיר_מכירה?.toFixed(2)}
                  </div>

                  {item.updated_date && (
                    <div className="text-xs text-gray-500 mb-3">
                      עודכן: {format(new Date(item.updated_date), 'dd/MM/yyyy HH:mm')}
                    </div>
                  )}

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 ml-1" />
                      ערוך
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 ml-1" />
                      מחק
                    </Button>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'לא נמצאו תוצאות' : 'אין פריטים'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}