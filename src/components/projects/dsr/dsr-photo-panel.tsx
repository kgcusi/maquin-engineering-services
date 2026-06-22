"use client";

import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import {
  confirmDsrPhotoAction,
  deleteDsrPhotoAction,
  getDsrPhotoUrlAction,
  presignDsrPhotoAction,
} from "@/modules/projects/dsr/actions";
import type { AttachmentRow } from "@/modules/files/service";
import type { Paginated } from "@/modules/shared/list-params";

// DSR photos ride the same polymorphic attachment pipeline as client documents —
// upload-on-pick (presign → PUT → confirm), scoped by `dsrId`. Holds references
// only; the gallery downloads via signed URLs.
export function DsrPhotoPanel({
  dsrId,
  photos,
  timeZone,
  canEdit,
}: {
  dsrId: string;
  photos: Paginated<AttachmentRow>;
  timeZone: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {canEdit ? (
        <FileUploader
          onRequestUrl={(meta) => presignDsrPhotoAction({ dsrId, ...meta })}
          onConfirm={(fileId, name) => confirmDsrPhotoAction({ dsrId, fileId, name })}
        />
      ) : null}
      <AttachmentList
        documents={photos.rows}
        page={photos.page}
        total={photos.total}
        pageSize={photos.pageSize}
        paramKey="photoPage"
        timeZone={timeZone}
        onDownload={(attachmentId) => getDsrPhotoUrlAction({ dsrId, attachmentId })}
        onDelete={
          canEdit ? (attachmentId) => deleteDsrPhotoAction({ dsrId, attachmentId }) : undefined
        }
      />
    </div>
  );
}
