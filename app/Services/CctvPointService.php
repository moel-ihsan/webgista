<?php

namespace App\Services;

use App\Models\CctvPoint;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class CctvPointService
{
    /**
     * Retrieve all CCTV points ordered from newest to oldest.
     *
     * @return Collection<int, CctvPoint>
     */
    public function listAll(): Collection
    {
        return CctvPoint::latest()->get();
    }

    /**
     * Create a new CCTV point and promote any staged temporary thumbnail.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): CctvPoint
    {
        $url = ! empty($data['url']) ? $data['url'] : null;
        $data['url'] = $url;
        $data['keterangan'] = $url ? 'Great' : 'No Data';

        $disk = Storage::disk('public');
        $tempPath = 'cctv/image/tmp.jpg';

        if ($disk->exists($tempPath)) {
            $permanentPath = 'cctv/image/'.uniqid().'.jpg';
            $disk->move($tempPath, $permanentPath);
            $data['path_image'] = $permanentPath;
        } else {
            $data['path_image'] = 'tf1.jpg';
        }

        return CctvPoint::create($data);
    }

    /**
     * Update an existing CCTV point while preserving a valid condition label.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(CctvPoint $cctvPoint, array $data): CctvPoint
    {
        $url = ! empty($data['url']) ? $data['url'] : null;
        $data['url'] = $url;

        if (! $url) {
            $data['keterangan'] = 'No Data';
        } elseif (
            in_array($cctvPoint->keterangan, CctvPoint::ALLOWED_CONDITIONS, true)
            && $cctvPoint->keterangan !== 'No Data'
        ) {
            $data['keterangan'] = $cctvPoint->keterangan;
        } else {
            $data['keterangan'] = 'Great';
        }

        $cctvPoint->update($data);

        return $cctvPoint->fresh();
    }

    /**
     * Update only the real-time traffic condition label for a CCTV point.
     */
    public function updateCondition(CctvPoint $cctvPoint, string $condition): CctvPoint
    {
        $cctvPoint->update(['keterangan' => $condition]);

        return $cctvPoint->fresh();
    }

    /**
     * Update the 5-point detection ROI coordinates for a CCTV point.
     *
     * @param  array<string, float|int>  $roi
     */
    public function updateRoi(CctvPoint $cctvPoint, array $roi): CctvPoint
    {
        $cctvPoint->update($roi);

        return $cctvPoint->fresh();
    }

    /**
     * Delete a CCTV point and clean up any uploaded public image.
     */
    public function delete(CctvPoint $cctvPoint): void
    {
        $disk = Storage::disk('public');

        if ($cctvPoint->path_image && strpos($cctvPoint->path_image, 'cctv/image/') === 0 && $disk->exists($cctvPoint->path_image)) {
            $disk->delete($cctvPoint->path_image);
        }

        $cctvPoint->delete();
    }

    /**
     * Store a temporary CCTV thumbnail before form submission.
     */
    public function storeTemporaryImage(UploadedFile $file): string
    {
        $disk = Storage::disk('public');
        $tempPath = 'cctv/image/tmp.jpg';

        if ($disk->exists($tempPath)) {
            $disk->delete($tempPath);
        }

        return (string) $file->storeAs('cctv/image', 'tmp.jpg', 'public');
    }

    /**
     * Replace the stored thumbnail image for an existing CCTV point.
     */
    public function replaceImage(CctvPoint $cctvPoint, UploadedFile $file): string
    {
        $disk = Storage::disk('public');

        if ($cctvPoint->path_image && strpos($cctvPoint->path_image, 'cctv/image/') === 0 && $disk->exists($cctvPoint->path_image)) {
            $disk->delete($cctvPoint->path_image);
        }

        $extension = $file->extension() ?: 'jpg';
        $filename = uniqid().'.'.$extension;
        $relativePath = 'cctv/image/'.$filename;

        $file->storeAs('cctv/image', $filename, 'public');
        $cctvPoint->update(['path_image' => $relativePath]);

        return 'public/'.$relativePath;
    }
}
