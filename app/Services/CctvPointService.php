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
     * Update the blue detection ROI polygon coordinates for a CCTV point.
     * Supports arbitrary N >= 3 vertices as well as legacy rec1x..rec5y payloads.
     *
     * @param  array<int|string, mixed>  $roi
     */
    public function updateRoi(CctvPoint $cctvPoint, array $roi): CctvPoint
    {
        $normalizedPoints = $this->normalizeRoiList($roi);
        $attributes = [
            'roi_polygon' => $normalizedPoints,
        ];

        $syncLegacy = count($normalizedPoints) === 5;
        for ($idx = 1; $idx <= 5; $idx++) {
            $point = $syncLegacy ? $normalizedPoints[$idx - 1] : null;
            $attributes["rec{$idx}x"] = $point ? $point['x'] : null;
            $attributes["rec{$idx}y"] = $point ? $point['y'] : null;
        }

        $cctvPoint->update($attributes);

        return $cctvPoint->fresh();
    }

    /**
     * Normalize either legacy `rec1x..rec5y` map or list of `['x' => float, 'y' => float]`.
     *
     * @param  array<int|string, mixed>  $roi
     * @return array<int, array{x: float, y: float}>
     */
    private function normalizeRoiList(array $roi): array
    {
        if (array_key_exists('rec1x', $roi)) {
            $points = [];
            for ($idx = 1; $idx <= 5; $idx++) {
                $points[] = [
                    'x' => round((float) ($roi["rec{$idx}x"] ?? 0), 2),
                    'y' => round((float) ($roi["rec{$idx}y"] ?? 0), 2),
                ];
            }

            return $points;
        }

        return array_values(array_map(function ($point) {
            return [
                'x' => round((float) ($point['x'] ?? 0), 2),
                'y' => round((float) ($point['y'] ?? 0), 2),
            ];
        }, $roi));
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
