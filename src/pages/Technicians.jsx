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
import { Plus, Edit, Trash2, Wrench, Phone, Search, Award, IdCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function TechniciansPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    שם_טכנאי: "",
    טלפון: "",
    חפ: "",
    מספר_הסמכה: "",
    טכנאי_גז_רמה: "",
    סוג_הסמכה: "כל הסוגים",
    פעיל: true
  });

  const queryClient = useQueryClient();

  const { data: technicians, isLoading } = useQuery({
    queryKey: ['טכנאי'],
    queryFn: () => base44.entities.טכנאי.list('-created_date'),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.טכנאי.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['טכנאי'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.טכנאי.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['טכנאי'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.טכנאי.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['טכנאי'] });
    },
  });

  const resetForm = () => {
    setFormData({
      שם_טכנאי: "",
      טלפון: "",
      חפ: "",
      מספר_הסמכה: "",
      טכנאי_גז_רמה: "",
      סוג_הסמכה: "כל הסוגים",
      פעיל: true
    });
    setEditingTechnician(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTechnician) {
      updateMutation.mutate({ id: editingTechnician.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (technician) => {
    setEditingTechnician(technician);
    setFormData({
      שם_טכנאי: technician.שם_טכנאי,
      טלפון: technician.טלפון,
      חפ: technician.חפ || "",
      מספר_הסמכה: technician.מספר_הסמכה || "",
      טכנאי_גז_רמה: technician.טכנאי_גז_רמה || "",
      סוג_הסמכה: technician.סוג_הסמכה,
      פעיל: technician.פעיל
    });
    setIsDialogOpen(true);
  };

  const filteredTechnicians = technicians.filter(tech =>
    tech.שם_טכנאי?.includes(searchTerm) ||
    tech.טלפון?.includes(searchTerm) ||
    tech.חפ?.includes(searchTerm) ||
    tech.מספר_הסמכה?.includes(searchTerm)
  );

  const certificationColors = {
    "התקנה": "bg-blue-100 text-blue-800",
    "תחזוקה": "bg-green-100 text-green-800",
    "בדיקות": "bg-purple-100 text-purple-800",
    "כל הסוגים": "bg-orange-100 text-orange-800"
  };

  const levelColors = {
    "1": "bg-gray-100 text-gray-800",
    "2": "bg-blue-100 text-blue-800",
    "3": "bg-indigo-100 text-indigo-800",
    "4": "bg-purple-100 text-purple-800"
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-8 h-8" />
              ניהול טכנאים
            </h1>
            <p className="text-gray-600 mt-1">רשימת כל הטכנאים במערכת</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={resetForm}>
                <Plus className="w-4 h-4 ml-2" />
                טכנאי חדש
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTechnician ? 'עריכת טכנאי' : 'טכנאי חדש'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>שם טכנאי *</Label>
                  <Input
                    value={formData.שם_טכנאי}
                    onChange={(e) => setFormData({...formData, שם_טכנאי: e.target.value})}
                    placeholder="הזן שם טכנאי"
                    required
                  />
                </div>
                <div>
                  <Label>טלפון *</Label>
                  <Input
                    value={formData.טלפון}
                    onChange={(e) => setFormData({...formData, טלפון: e.target.value})}
                    placeholder="הזן מספר טלפון"
                    required
                  />
                </div>
                <div>
                  <Label>ח.פ</Label>
                  <Input
                    value={formData.חפ}
                    onChange={(e) => setFormData({...formData, חפ: e.target.value})}
                    placeholder="הזן ח.פ של הטכנאי"
                  />
                </div>
                <div>
                  <Label>מספר הסמכה</Label>
                  <Input
                    value={formData.מספר_הסמכה}
                    onChange={(e) => setFormData({...formData, מספר_הסמכה: e.target.value})}
                    placeholder="הזן מספר הסמכה"
                  />
                </div>
                <div>
                  <Label>רמת טכנאי גז</Label>
                  <Select value={formData.טכנאי_גז_רמה} onValueChange={(value) => setFormData({...formData, טכנאי_גז_רמה: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר רמה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">רמה 1</SelectItem>
                      <SelectItem value="2">רמה 2</SelectItem>
                      <SelectItem value="3">רמה 3</SelectItem>
                      <SelectItem value="4">רמה 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>סוג הסמכה *</Label>
                  <Select value={formData.סוג_הסמכה} onValueChange={(value) => setFormData({...formData, סוג_הסמכה: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="התקנה">התקנה</SelectItem>
                      <SelectItem value="תחזוקה">תחזוקה</SelectItem>
                      <SelectItem value="בדיקות">בדיקות</SelectItem>
                      <SelectItem value="כל הסוגים">כל הסוגים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.פעיל}
                    onCheckedChange={(checked) => setFormData({...formData, פעיל: checked})}
                  />
                  <Label>טכנאי פעיל</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingTechnician ? 'עדכן' : 'צור טכנאי'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="חיפוש טכנאי לפי שם, טלפון, ח.פ או מספר הסמכה..."
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
                  <TableHead>שם טכנאי</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>ח.פ</TableHead>
                  <TableHead>מספר הסמכה</TableHead>
                  <TableHead>רמת טכנאי גז</TableHead>
                  <TableHead>סוג הסמכה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTechnicians.map((technician) => (
                  <TableRow key={technician.id}>
                    <TableCell className="font-medium">{technician.שם_טכנאי}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {technician.טלפון}
                      </div>
                    </TableCell>
                    <TableCell>
                      {technician.חפ ? (
                        <div className="flex items-center gap-2">
                          <IdCard className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{technician.חפ}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {technician.מספר_הסמכה ? (
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{technician.מספר_הסמכה}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {technician.טכנאי_גז_רמה ? (
                        <Badge className={levelColors[technician.טכנאי_גז_רמה]}>
                          רמה {technician.טכנאי_גז_רמה}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={certificationColors[technician.סוג_הסמכה]}>
                        {technician.סוג_הסמכה}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={technician.פעיל ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {technician.פעיל ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(technician)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteMutation.mutate(technician.id)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}