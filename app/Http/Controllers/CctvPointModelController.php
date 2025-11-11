<?php

namespace App\Http\Controllers;

use App\Models\CctvPoint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CctvPointModelController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $valid = $request->validate([
            'name' => ['required'],
            'category' => ['required'],
            'address' => ['required'],
            'lattitude' => ['required'],
            'longitude' => ['required'],
            'agency' => ['required'],
            // 'path_image' => [''],
            // 'url' => [],
        ]);
        $valid['url'] = ($request->get('url')) ? $request->get('url') : NULL;
        // $request->file('image');
        $valid['path_image'] = 'cctv/image/' . uniqid() . '.jpg';

        if (!$valid['url']) {
            $valid['keterangan'] = 'No Data';
        } else {
            $valid['keterangan'] = 'Great';
        }

        // $valid['keterangan'] = 'Low';
        Storage::move('./public/cctv/image/tmp.jpg', 'public/' . $valid['path_image']);
        CctvPoint::create($valid);
        return response()->json(['image' => $request->file('image')]);
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show(CctvPoint $cctvPoint)
    {
        return view('detail', compact('cctvPoint'));
    }

    public function showCCTV(CctvPoint $cctvPoint)
    {
        return $cctvPoint->url;
    }

    public function showvideo(CctvPoint $cctvPoint)
    {
        return view('videodetail', compact('cctvPoint'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  CctvPoint $cctvPoint
     * @return \Illuminate\Http\Response
     */
    public function edit(CctvPoint $cctvPoint)
    {
        return view('edit', compact('cctvPoint'));
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(CctvPoint $cctvPoint)
    {
        $valid = request()->validate([
            'name' => ['required'],
            'category' => ['required'],
            'address' => ['required'],
            'lattitude' => ['required'],
            'longitude' => ['required'],
            'agency' => ['required'],
        ]);

        $valid['url'] = (request()->get('url')) ? request()->get('url') : null;

        if (!$valid['url']) {
            $valid['keterangan'] = 'No Data';
        } else {
            $valid['keterangan'] = 'Low';
        }

        $cctvPoint->update($valid);
        return response()->json(['image' => request()->file('image'), 'valid' => $valid]);
    }

    // public function updateVeh(CctvPoint $cctvPoint)
    // {
    //     $valid = request()->validate([
    //         'car' => ['required'],
    //     ]);

    //     $cctvPoint->update($valid);
    // }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy(CctvPoint $cctvPoint)
    {
        $cctvPoint->delete();
    }

    public function upload(Request $request)
    {
        $file = $request->file('image');
        if (Storage::exists('public/cctv/image/tmp.jpg'))
            Storage::delete('public/cctv/image/tmp.jpg');
        return response()->json(['image' => $file->storeAs('public/cctv/image', 'tmp.jpg')]);
    }
    public function uploadEdit(CctvPoint $cctvPoint)
    {
        $file = request()->file('image');
        if (Storage::exists($cctvPoint->path_image))
            Storage::delete($cctvPoint->path_image);
        $path_image = uniqid() . '.jpg';
        $cctvPoint->update([
            'path_image' => 'cctv/image/' . $path_image
        ]);
        return response()->json(['image' => $file->storeAs('public/cctv/image', $path_image)]);
    }
}
