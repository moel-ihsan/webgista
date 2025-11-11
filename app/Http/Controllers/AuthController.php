<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function init()
    {
        return response()->json(['user' => User::first()], 200);
    }
    public function authUser()
    {
        return response()->json(['user' => Auth::guard('web')->user()], 200);
    }
    public function login()
    {
        return view('login');
    }
    public function auth(Request $request)
    {
        // Validate the form data
        $data = $request->validate([
            'email' => ['required'],
            'password' => ['required']
        ]);

        // return response()->json(['status' => $data]);
        if (Auth::attempt($data))
            return response()->json(['status' => 'Berhasil login', 'isAuth' => true]);

        return response()->json(['status' => 'Wrong Email / Password', 'isAuth' => false]);
    }

    public function logout()
    {
        Auth::logout();
        return redirect()->route('home');
    }

    public function edit(User $user)
    {
        return view('profile', compact('user'));
    }

    public function update(User $user)
    {
        $valid = request()->validate([
            'name' => ['required'],
            'address' => ['required'],
            'lattitude' => ['required'],
            'longitude' => ['required'],
            'description' => ['required'],
            'profile_photo_path',

        ]);

        $user->update($valid);
        return response()->json(['image' => request()->file('image'), 'valid' => $valid]);
    }

    public function upload(Request $request)
    {
        $file = $request->file('image');
        if (Storage::exists('public/user/image/avatar.jpg'))
            Storage::delete('public/user/image/avatar.jpg');
        return response()->json(['image' => $file->storeAs('public/user/image', 'avatar.jpg')]);
    }

    public function uploadEdit(User $user)
    {
        $file = request()->file('image');
        if (Storage::exists($user->profile_photo_path))
            Storage::delete($user->profile_photo_path);
        $profile_photo_path = uniqid() . '.jpg';
        $user->update([
            'profile_photo_path' => 'user/image/' . $profile_photo_path
        ]);
        return response()->json(['image' => $file->storeAs('public/user/image', $profile_photo_path)]);
    }

    //     // tes admin user
    //     public function register()
    //     {
    //         return view('auth/register');
    //     }

    //     public function store(Request $request)
    //     {
    //         User::create([
    //             'nama' => $request->nama,
    //             'email' => $request->email,
    //             'nipnim' => $request->nik,
    //             'password' => bcrypt($request->password),
    //         ]);

    //         return redirect()->route('auth.login');
    //     }
    public function changePassword(User $user)
    {
        $valid = request()->validate([
            'curPas' => ['required'],
            'newPas' => ['required'],
            'confirm' => ['required'],
        ]);

        if (password_verify($valid['curPas'], $user['password'])) {
            $user->update(['password' => bcrypt($valid['newPas'])]);
            Auth::attempt(['email' => $user['email'], 'password' => $user['password']]);
            return response()->json(['message' => 'password berhasil diubah', 'status' => 200]);
        }
        return response()->json(['message' => 'password sekarang tidak sama', 'status' => 404]);
    }
}
