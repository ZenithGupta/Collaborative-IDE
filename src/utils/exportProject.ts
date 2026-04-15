import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ExportFile {
  name: string;
  path: string;
  content: string | null;
  is_folder: boolean;
}

/**
 * Exports all project files as a .zip archive, preserving folder structure.
 */
export async function exportProjectAsZip(
  projectName: string,
  files: ExportFile[]
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    if (file.is_folder) continue;

    const filePath = file.path || file.name;
    zip.file(filePath, file.content || '');
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  saveAs(blob, `${safeName}.zip`);
}
