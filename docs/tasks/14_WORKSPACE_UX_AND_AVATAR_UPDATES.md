# Task 12: Workspace Switcher Enhancements & Avatar Dropdown Update

## Objective
Refine the Dashboard Top Navbar UX by adding a "Client Side" link inside the Avatar Dropdown, adding dynamic First-Letter Avatars & Base64 Logo uploads for Workspaces, and enhancing the Workspace Switcher dropdown shadow styling.

---

## Detailed Requirements

### 1. Avatar Dropdown Update
- **Location:** `@components/dashboard/UserAvatarDropdown.tsx` (or Top Header).
- Add a new menu item: `🌐 Client Side` (between "Manage account" and "Sign out").
- On click, navigate/redirect to the client root URL (`/`).
- Do NOT alter the top-left Driplare logo functionality.

### 2. Workspace Switcher Component Refactoring
- **Location:** `@components/dashboard/WorkspaceSwitcher.tsx`.
- **Dropdown Shadow:** Add `shadow-2xl border border-slate-100` to the dropdown card container.
- **Dynamic Avatar Display:**
  - If `workspace.logo_url` exists: Render the `<img src={workspace.logo_url} />`.
  - Else: Render a fallback square/rounded badge showing `workspace.name.charAt(0).toUpperCase()` with a background color (e.g. `bg-purple-600 text-white font-semibold`).

### 3. "Add New Business" Modal with Base64 Logo Upload
- **Location:** `@components/dashboard/AddWorkspaceModal.tsx` (or embedded modal).
- Add a logo file picker: `<input type="file" accept="image/*" />`.
- Convert uploaded image to Base64 string via JavaScript `FileReader` (`readAsDataURL`).
- Show image preview once selected.
- Send the Base64 string as `logo_url` in the database insert/API call when creating the brand.

---

## Checklist 📁
- [ ] `docs/tasks/14_WORKSPACE_UX_AND_AVATAR_UPDATES.md`
- [ ] Update Avatar Dropdown with `Client Side` link.
- [ ] Update Workspace Switcher with First-Letter badges & `shadow-2xl`.
- [ ] Implement Base64 file upload in Add Brand modal.