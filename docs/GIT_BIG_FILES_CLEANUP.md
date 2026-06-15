# GitHub 100MB Limit – Büyük Dosya Temizliği Rehberi

**Rol:** Kıdemli Git/GitHub mühendisi  
**Ortam:** Windows, PowerShell  
**Repo kök:** `C:\Users\Bulka\Projects\MultiPlatformDentalApp`

Bu dokümanda yapılan işlemlerin özeti, her adımda beklenen çıktılar ve alternatif çözümler yer alır.

---

## 1) Mevcut durumu doğrulama

**Komutlar (PowerShell):**
```powershell
cd "C:\Users\Bulka\Projects\MultiPlatformDentalApp"
git status
git rev-parse --is-inside-work-tree
git remote -v
git branch
git log -1 --oneline
git ls-files | Select-String -Pattern "\.angular"
git ls-files | Select-String -Pattern "crash_log"
```

**Ne beklemeliyim?**
- `git status`: Hangi branch’te olduğunuz, commit/push durumu.
- `rev-parse`: `true` (repo içindesiniz).
- `remote -v`: `origin` URL’i (örn. GitHub).
- `branch`: Aktif branch (örn. `* main`).
- `log -1`: Son commit hash + mesaj.
- `ls-files` + `.angular`: Index’teki `dental-app-web/.angular/` dosyaları (varsa satırlar gelir).
- `ls-files` + `crash_log`: `DentalApp.Desktop/crash_log.txt` (varsa bir satır).

**Sorun olursa:**
- `pathspec did not match`: Bu path’ler hiç commit edilmemiş; sadece .gitignore ekleyip push yeterli.
- Büyük dosya path’i farklıysa: `git ls-files` çıktısına göre aşağıdaki `git rm --cached` path’lerini güncelleyin.

---

## 2) .gitignore güncelleme

**Yapılan:** Kök `.gitignore` dosyasına şu kurallar eklendi:
```gitignore
# Angular build cache (do not commit)
dental-app-web/.angular/
**/.angular/

# Crash / app logs
crash_log.txt
DentalApp.Desktop/crash_log.txt
```

**Komutlar:**
```powershell
git add .gitignore
git status
```

**Ne beklemeliyim?**
- `Changes to be committed: modified: .gitignore`

**Sorun olursa:** `.gitignore` yoksa `New file: .gitignore` görünür; normal.

---

## 3) Diskten silmeden takipten çıkarma

**Komutlar:**
```powershell
git rm -r --cached dental-app-web/.angular
git rm --cached DentalApp.Desktop/crash_log.txt
git status
```

**Ne beklemeliyim?**
- `.angular` için: Çok sayıda `deleted: dental-app-web/.angular/...` satırı.
- `crash_log.txt` için: `rm 'DentalApp.Desktop/crash_log.txt'`.
- `git status`: Bu dosyalar "deleted" (index’ten silindi), working tree’de dosyalar duruyor.

**Sorun olursa – "pathspec did not match":**
- Doğru path’i bulun: `git ls-files | Select-String "angular"` veya `crash_log`.
- Path farklıysa (örn. `dental-app-web\.angular`): Komutu o path ile tekrarlayın.

**Sonra commit:**
```powershell
git commit -m "chore: ignore Angular cache and crash logs"
```

---

## 4) Geçmişten tamamen temizleme (git-filter-repo)

Push hâlâ reddedilir; çünkü büyük dosyalar eski commit’lerde duruyor. Geçmişi yeniden yazmak gerekir.

**Kurulum kontrolü:**
```powershell
git-filter-repo --version
```
- Çıktı: commit hash benzeri bir string (örn. `a40bce548d2c`).

**Kurulum yoksa:**
```powershell
pip install git-filter-repo
```
- Yetki yoksa: `pip install --user git-filter-repo`  
- Pip yoksa / yetki yoksa: Aşağıdaki **Alternatif 1 / Alternatif 2** bölümüne bakın.

**Geçmişten çıkarma (tek seferde):**
```powershell
cd "C:\Users\Bulka\Projects\MultiPlatformDentalApp"
git-filter-repo --path dental-app-web/.angular --invert-paths --path DentalApp.Desktop/crash_log.txt --invert-paths --force
```

**Ne beklemeliyim?**
- `NOTICE: Removing 'origin' remote; ...` (origin silinir; güvenlik nedeniyle normal).
- `Parsed N commits`, `HEAD is now at ... chore: ignore Angular cache and crash logs`.
- `New history written ... Repacking ... Completely finished`.

**Sonuç kontrolü:**
```powershell
git count-objects -vH
git log -1 --oneline
```
- `size-pack`: Birkaç MB civarı olmalı (önceden 100MB+ ise büyük düşüş).
- Son commit: "chore: ignore Angular cache and crash logs".

**Sorun olursa:** `--force` olmadan çalıştırırsanız "fresh clone" uyarısı alabilirsiniz; `--force` ekleyin. Remote’u sonra tekrar ekleyeceğiz.

---

## 5) Remote’u ekleyip force push

**Komutlar:**
```powershell
git remote add origin https://github.com/bulsahkecici/MultiPlatformDentalApp.git
git push --force origin main
```

**Ne beklemeliyim?**
- `main -> main (forced update)`.
- Başka branch kullanıyorsanız: `git push --force origin <branch-adı>`.

**Sorun olursa:** `remote origin already exists` → Zaten filter-repo sonrası eklediysek atlayın. İlk kez ekliyorsanız: `git remote remove origin` sonra tekrar `add`.

---

## 6) Son kontrol

**Komutlar:**
```powershell
git status
git check-ignore -v dental-app-web/.angular/cache
git ls-files | Select-String -Pattern "\.angular"
git ls-files | Select-String -Pattern "crash_log"
```

**Ne beklemeliyim?**
- `git status`: `nothing to commit, working tree clean` (ve branch origin ile uyumlu).
- `check-ignore`: `.gitignore:39:**/.angular/	dental-app-web/.angular/cache` (ignore kuralı eşleşiyor).
- İki `ls-files` komutu: Çıktı **boş** (artık bu path’ler takip edilmiyor).

---

## 7) pip kurulumu mümkün değilse

**Alternatif 1 – pip --user + PATH**
```powershell
pip install --user git-filter-repo
```
- Script genelde: `%APPDATA%\Python\Python3x\Scripts\git-filter-repo` veya `%USERPROFILE%\AppData\Roaming\Python\Python3x\Scripts`.
- Bu klasörü PATH’e ekleyin veya tam yolu kullanın: `& "$env:APPDATA\Python\Python311\Scripts\git-filter-repo.exe" ...`

**Alternatif 2 – BFG Repo-Cleaner (Java)**
1. [BFG](https://rtyley.github.io/bfg-repo-cleaner/) indir (bfg-x.x.x.jar).
2. Önce 3. adımdaki commit’i yapın (index’ten çıkarma + commit).
3. Büyük dosyaları silmek için:
   ```powershell
   java -jar bfg.jar --delete-files "0.pack" .
   java -jar bfg.jar --delete-files "crash_log.txt" .
   ```
   veya klasörü silmek için:
   ```powershell
   java -jar bfg.jar --delete-folders ".angular" .
   ```
4. Temizlik: `git reflog expire --expire=now --all && git gc --prune=now --aggressive`
5. `git push --force origin main`

---

## 8) Ek önlemler

**Angular cache’in tekrar girmemesi**
- Kök `.gitignore` içinde `dental-app-web/.angular/` ve `**/.angular/` olduğundan emin olun (yapıldı).
- `dental-app-web` altında ek bir `.gitignore` ile `.angular/` eklemek isteğe bağlı (kök kural yeterli).

**crash_log.txt’in büyümemesi**
- Uygulama tarafında log rotasyonu kullanın: günlük max boyut veya rolling file (örn. NLog / Serilog ile max size + archive).
- Örnek (NLog): `fileName="crash_log.txt" maxArchiveFiles="5" archiveAboveSize="10485760"` (10MB üstü arşiv).

---

## Özet – Bu repoda yapılanlar

| Adım | Durum |
|------|--------|
| 1. Durum doğrulandı | Branch: main, origin tanımlı, .angular ve crash_log index’te tespit edildi |
| 2. .gitignore güncellendi | dental-app-web/.angular/, **/.angular/, crash_log.txt kuralları eklendi |
| 3. Index’ten çıkarıldı | git rm -r --cached .angular, git rm --cached crash_log.txt + commit |
| 4. Geçmiş temizlendi | git-filter-repo ile path’ler geçmişten kaldırıldı |
| 5. Force push | origin main’e force push başarılı |
| 6. Doğrulama | .angular ve crash_log artık tracked değil; check-ignore eşleşiyor |

Repo artık 100MB limitine takılmadan push kabul edecektir.
