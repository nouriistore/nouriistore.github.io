import os
import sys
import json
import subprocess
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("     🌸 أداة المزامنة التلقائية لمتجر Nourii 🌸")
print("          Google Drive / Local -> GitHub")
print("=" * 60)

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIRECTORY)

# 1. تحقق من حالة Git
print("\n[1/3] فحص مستودع Git المحلي...")
try:
    status = subprocess.check_output(["git", "status", "--porcelain"], text=True)
    print("ملفات معدلة:")
    print(status if status.strip() else "لا توجد تعديلات غير محفوظة.")
except Exception as e:
    print(f"خطأ في فحص Git: {e}")
    sys.exit(1)

# 2. إضافة التعديلات إلى Git
print("\n[2/3] تجهيز التعديلات (Staging & Commit)...")
try:
    subprocess.run(["git", "add", "config.js", "products.js", "admin.html", "admin.js", "admin.css", "index.html", "app.js", "README.md", "google_apps_script_backend.js", "docs/"], check=True)
    commit_res = subprocess.run(["git", "commit", "-m", "sync: update store items, config, and admin portal"], capture_output=True, text=True)
    if "nothing to commit" in commit_res.stdout:
        print("المستودع محدث بالفعل، لا توجد تغييرات جديدة للحفظ.")
    else:
        print("تم تسجيل التعديلات (Commit) بنجاح!")
except Exception as e:
    print(f"تنبيه أثناء commit: {e}")

# 3. رفع التعديلات إلى GitHub
print("\n[3/3] رفع التعديلات (Git Push) إلى GitHub...")
try:
    push_res = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
    if push_res.returncode == 0:
        print("\n" + "=" * 60)
        print("🎉 تم رفع ومزامنة التعديلات بنجاح إلى GitHub!")
        print("👉 رابط المتجر المباشر: https://nouriistore.github.io/")
        print("=" * 60)
    else:
        print(f"تنبيه أثناء الرفع: {push_res.stderr}")
except Exception as e:
    print(f"خطأ أثناء الرفع: {e}")

input("\nاضغط Enter للخروج...")
