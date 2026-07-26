// مطابقة صريحة لـ /customers/new في slot المودال → مفيش مودال هنا،
// وده بيمنع الـ intercepting route (.)[id] من اعتبار "new" رقم عميل،
// فصفحة "عميل جديد" بتفتح مباشرةً من غير reload.
export default function NewNoModal() {
  return null;
}
