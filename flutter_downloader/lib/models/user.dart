class User {
  final int id;
  final String email;
  final String name;
  final String? phoneNumber;
  final String role;
  final String status;
  final String? token;

  User({
    required this.id,
    required this.email,
    required this.name,
    this.phoneNumber,
    required this.role,
    required this.status,
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      name: json['name'] as String,
      phoneNumber: json['phoneNumber'] as String?,
      role: json['role'] as String,
      status: json['status'] as String,
      token: json['token'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'phoneNumber': phoneNumber,
      'role': role,
      'status': status,
      'token': token,
    };
  }

  User copyWith({
    int? id,
    String? email,
    String? name,
    String? phoneNumber,
    String? role,
    String? status,
    String? token,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      role: role ?? this.role,
      status: status ?? this.status,
      token: token ?? this.token,
    );
  }
}
